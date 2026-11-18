import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../../src/app";
import { env } from "../../src/config/env";
import { pool } from "../../src/config/database";

interface ProductResource {
  id: string;
  sku: string;
  name: string;
  isActive: boolean;
}

interface InventoryResource {
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  productIsActive: boolean;
}

interface OrderResource {
  id: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
}

let adminToken = "";
let warehouseToken = "";
let salesToken = "";
let categoryId = "";
let customerId = "";
let warehouseIds: string[] = [];
let lifecycleProduct: ProductResource;
let zeroProduct: ProductResource;
let concurrencyProduct: ProductResource;

const createdProductIds: string[] = [];
const createdOrderIds: string[] = [];
const runId = randomUUID();

function expectStatus(
  response: { status: number; body: unknown },
  expectedStatus: number,
): void {
  assert.equal(response.status, expectedStatus, JSON.stringify(response.body));
}

function expectError(
  response: { status: number; body: unknown },
  expectedStatus: number,
  expectedCode: string,
): void {
  expectStatus(response, expectedStatus);
  assert.equal(
    (response.body as { code?: string }).code,
    expectedCode,
    JSON.stringify(response.body),
  );
}

async function login(
  email: string,
  password: string | undefined,
  role: string,
): Promise<string> {
  assert.ok(password, `Password for ${role} is not configured.`);

  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });

  expectStatus(response, 200);
  assert.equal(response.body.data?.user?.role, role);
  assert.ok(response.body.data?.accessToken);

  return response.body.data.accessToken as string;
}

async function createProduct(
  label: string,
  category: string,
): Promise<ProductResource> {
  const sku = `SF01-${label}-${runId.slice(0, 10)}`.toUpperCase();
  const response = await request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      categoryId: category,
      sku,
      name: `SF01 ${label} ${runId.slice(0, 8)}`,
      unitPrice: "12.00",
    });

  expectStatus(response, 201);
  const product = response.body.data?.product as ProductResource | undefined;
  assert.ok(product, "Created product is missing.");
  createdProductIds.push(product.id);
  return product;
}

async function receive(
  productId: string,
  warehouseId: string,
  quantity: number,
): Promise<{ status: number; body: unknown }> {
  return request(app)
    .post("/api/v1/inventory/receipts")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ productId, warehouseId, quantity });
}

async function getStock(
  productId: string,
  warehouseId: string,
): Promise<number | null> {
  const result = await pool.query<{ quantity_on_hand: number }>(
    `SELECT quantity_on_hand
     FROM inventory
     WHERE product_id = $1 AND warehouse_id = $2`,
    [productId, warehouseId],
  );
  return result.rows[0]?.quantity_on_hand ?? null;
}

async function createOrder(
  productId: string,
  quantity: number,
): Promise<OrderResource> {
  const response = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerId,
      warehouseId: warehouseIds[0]!,
      items: [{ productId, quantity }],
    });

  expectStatus(response, 201);
  const order = response.body.data?.order as OrderResource | undefined;
  assert.ok(order, "Created order is missing.");
  createdOrderIds.push(order.id);
  return order;
}

before(async () => {
  adminToken = await login(
    "admin@stockflow.local",
    env.SEED_ADMIN_PASSWORD,
    "ADMIN",
  );
  warehouseToken = await login(
    "warehouse@stockflow.local",
    env.SEED_WAREHOUSE_PASSWORD,
    "WAREHOUSE_STAFF",
  );
  salesToken = await login(
    "sales@stockflow.local",
    env.SEED_SALES_PASSWORD,
    "SALES_STAFF",
  );

  const [warehouses, customers] = await Promise.all([
    pool.query<{ id: string }>(
      `SELECT id FROM warehouses WHERE is_active = TRUE ORDER BY id LIMIT 2`,
    ),
    pool.query<{ id: string }>(`SELECT id FROM customers ORDER BY id LIMIT 1`),
  ]);
  assert.equal(
    warehouses.rows.length,
    2,
    "Two active warehouses are required.",
  );
  assert.ok(customers.rows[0], "A seeded customer is required.");
  warehouseIds = warehouses.rows.map((warehouse) => warehouse.id);
  customerId = customers.rows[0].id;

  const categoryResponse = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `SF01 ${runId}`,
      description: "Lifecycle integration tests.",
    });
  expectStatus(categoryResponse, 201);
  categoryId = categoryResponse.body.data?.category?.id as string;
  assert.ok(categoryId, "Created category ID is missing.");

  lifecycleProduct = await createProduct("LIFECYCLE", categoryId);
  zeroProduct = await createProduct("ZERO", categoryId);
  concurrencyProduct = await createProduct("CONCURRENCY", categoryId);

  expectStatus(await receive(lifecycleProduct.id, warehouseIds[0]!, 10), 201);
  expectStatus(await receive(lifecycleProduct.id, warehouseIds[1]!, 6), 201);
  expectStatus(await receive(concurrencyProduct.id, warehouseIds[0]!, 2), 201);
});

after(async () => {
  // Test fixtures remain in the append-only test database. The stock movement
  // ledger and order audit records are intentionally not deleted.
});

test("deactivation preserves zero and multi-warehouse inventory and filters", async () => {
  for (const product of [lifecycleProduct, zeroProduct]) {
    const response = await request(app)
      .patch(`/api/v1/products/${product.id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expectStatus(response, 200);
    assert.equal(response.body.data?.product?.isActive, false);
  }

  const inventoryResponse = await request(app)
    .get("/api/v1/inventory")
    .query({ productId: lifecycleProduct.id, limit: 100, offset: 0 })
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(inventoryResponse, 200);
  const balances = inventoryResponse.body.data?.inventory as
    InventoryResource[] | undefined;
  assert.ok(balances);
  assert.deepEqual(
    balances
      .map((balance) => [balance.warehouseId, balance.quantityOnHand])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
    [
      [warehouseIds[0], 10],
      [warehouseIds[1], 6],
    ].sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
  assert.ok(balances.every((balance) => !balance.productIsActive));

  const activeList = await request(app)
    .get("/api/v1/products")
    .query({ search: lifecycleProduct.sku })
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(activeList, 200);
  assert.equal(activeList.body.data?.total, 0);

  const firstInactivePage = await request(app)
    .get("/api/v1/products")
    .query({
      status: "inactive",
      search: runId.slice(0, 10),
      limit: 1,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(firstInactivePage, 200);
  assert.equal(firstInactivePage.body.data?.total, 2);
  assert.equal(firstInactivePage.body.data?.products.length, 1);

  const secondInactivePage = await request(app)
    .get("/api/v1/products")
    .query({
      status: "inactive",
      search: runId.slice(0, 10),
      limit: 1,
      offset: 1,
    })
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(secondInactivePage, 200);
  assert.equal(secondInactivePage.body.data?.products.length, 1);

  for (const token of [salesToken, warehouseToken]) {
    const forbiddenList = await request(app)
      .get("/api/v1/products")
      .query({ status: "inactive" })
      .set("Authorization", `Bearer ${token}`);
    expectError(forbiddenList, 403, "FORBIDDEN");
  }
});

test("inactive stock can only be cleared from existing balances without going negative", async () => {
  const issueResponse = await request(app)
    .post("/api/v1/inventory/issues")
    .set("Authorization", `Bearer ${warehouseToken}`)
    .send({
      warehouseId: warehouseIds[0],
      productId: lifecycleProduct.id,
      quantity: 2,
    });
  expectStatus(issueResponse, 201);
  assert.equal(issueResponse.body.data?.inventory?.quantityOnHand, 8);

  const adjustmentResponse = await request(app)
    .post("/api/v1/inventory/adjustments")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: warehouseIds[0],
      productId: lifecycleProduct.id,
      quantityDelta: -3,
      reason: "Inactive product clearance",
    });
  expectStatus(adjustmentResponse, 201);
  assert.equal(adjustmentResponse.body.data?.inventory?.quantityOnHand, 5);

  const rejectedReceipt = await receive(
    lifecycleProduct.id,
    warehouseIds[0]!,
    1,
  );
  expectError(rejectedReceipt, 409, "PRODUCT_INACTIVE");

  const rejectedPositiveAdjustment = await request(app)
    .post("/api/v1/inventory/adjustments")
    .set("Authorization", `Bearer ${warehouseToken}`)
    .send({
      warehouseId: warehouseIds[0],
      productId: lifecycleProduct.id,
      quantityDelta: 1,
      reason: "Not allowed while inactive",
    });
  expectError(rejectedPositiveAdjustment, 409, "PRODUCT_INACTIVE");

  const overIssue = await request(app)
    .post("/api/v1/inventory/issues")
    .set("Authorization", `Bearer ${warehouseToken}`)
    .send({
      warehouseId: warehouseIds[0],
      productId: lifecycleProduct.id,
      quantity: 6,
    });
  expectError(overIssue, 409, "INSUFFICIENT_STOCK");

  const overAdjustment = await request(app)
    .post("/api/v1/inventory/adjustments")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: warehouseIds[0],
      productId: lifecycleProduct.id,
      quantityDelta: -6,
      reason: "Must not make stock negative",
    });
  expectError(overAdjustment, 409, "INSUFFICIENT_STOCK");
  assert.equal(await getStock(lifecycleProduct.id, warehouseIds[0]!), 5);

  const noBalanceClearance = await request(app)
    .post("/api/v1/inventory/issues")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: warehouseIds[0],
      productId: zeroProduct.id,
      quantity: 1,
    });
  expectError(noBalanceClearance, 404, "INVENTORY_NOT_FOUND");
  assert.equal(await getStock(zeroProduct.id, warehouseIds[0]!), null);

  const inactiveOrder = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerId,
      warehouseId: warehouseIds[0],
      items: [{ productId: lifecycleProduct.id, quantity: 1 }],
    });
  expectError(inactiveOrder, 404, "PRODUCT_NOT_FOUND_OR_INACTIVE");
});

test("inactive products block draft updates and confirmation but allow confirmed cancellation", async () => {
  const reactivateResponse = await request(app)
    .patch(`/api/v1/products/${lifecycleProduct.id}/reactivate`)
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(reactivateResponse, 200);
  assert.equal(reactivateResponse.body.data?.product?.isActive, true);

  const draft = await createOrder(lifecycleProduct.id, 1);
  const deactivateResponse = await request(app)
    .patch(`/api/v1/products/${lifecycleProduct.id}/deactivate`)
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(deactivateResponse, 200);

  const updateInactiveDraft = await request(app)
    .patch(`/api/v1/orders/${draft.id}`)
    .set("Authorization", `Bearer ${salesToken}`)
    .send({ items: [{ productId: lifecycleProduct.id, quantity: 2 }] });
  expectError(updateInactiveDraft, 404, "PRODUCT_NOT_FOUND_OR_INACTIVE");

  const confirmInactiveDraft = await request(app)
    .post(`/api/v1/orders/${draft.id}/confirm`)
    .set("Authorization", `Bearer ${adminToken}`);
  expectError(confirmInactiveDraft, 409, "ORDER_PRODUCT_INACTIVE");
  assert.equal(await getStock(lifecycleProduct.id, warehouseIds[0]!), 5);

  const reactivateAgain = await request(app)
    .patch(`/api/v1/products/${lifecycleProduct.id}/reactivate`)
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(reactivateAgain, 200);

  const confirmedOrder = await createOrder(lifecycleProduct.id, 2);
  const confirmResponse = await request(app)
    .post(`/api/v1/orders/${confirmedOrder.id}/confirm`)
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(confirmResponse, 200);
  assert.equal(confirmResponse.body.data?.order?.status, "CONFIRMED");
  assert.equal(await getStock(lifecycleProduct.id, warehouseIds[0]!), 3);

  const deactivateBeforeCancel = await request(app)
    .patch(`/api/v1/products/${lifecycleProduct.id}/deactivate`)
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(deactivateBeforeCancel, 200);

  const cancelResponse = await request(app)
    .post(`/api/v1/orders/${confirmedOrder.id}/cancel`)
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(cancelResponse, 200);
  assert.equal(cancelResponse.body.data?.order?.status, "CANCELLED");
  assert.equal(await getStock(lifecycleProduct.id, warehouseIds[0]!), 5);
});

test("only ADMIN can reactivate and the product returns to normal use", async () => {
  for (const token of [salesToken, warehouseToken]) {
    const forbidden = await request(app)
      .patch(`/api/v1/products/${lifecycleProduct.id}/reactivate`)
      .set("Authorization", `Bearer ${token}`);
    expectError(forbidden, 403, "FORBIDDEN");
  }

  const response = await request(app)
    .patch(`/api/v1/products/${lifecycleProduct.id}/reactivate`)
    .set("Authorization", `Bearer ${adminToken}`);
  expectStatus(response, 200);
  assert.equal(response.body.data?.product?.isActive, true);

  const receiptResponse = await receive(
    lifecycleProduct.id,
    warehouseIds[0]!,
    1,
  );
  expectStatus(receiptResponse, 201);
  const receiptBody = receiptResponse.body as {
    data?: { inventory?: { quantityOnHand?: number } };
  };
  assert.equal(receiptBody.data?.inventory?.quantityOnHand, 6);

  const newOrder = await createOrder(lifecycleProduct.id, 1);
  assert.equal(newOrder.status, "DRAFT");
});

test("deactivation serializes with concurrent stock movement", async () => {
  const client = await pool.connect();
  let transactionOpen = true;
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM products WHERE id = $1 FOR SHARE`, [
      concurrencyProduct.id,
    ]);

    let deactivationFinished = false;
    const deactivation = request(app)
      .patch(`/api/v1/products/${concurrencyProduct.id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .then((response) => {
        deactivationFinished = true;
        return response;
      });

    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(
      deactivationFinished,
      false,
      "Deactivation must wait for an in-flight shared product lock.",
    );

    const movement = request(app)
      .post("/api/v1/inventory/issues")
      .set("Authorization", `Bearer ${warehouseToken}`)
      .send({
        warehouseId: warehouseIds[0],
        productId: concurrencyProduct.id,
        quantity: 1,
      });

    await new Promise((resolve) => setTimeout(resolve, 50));
    await client.query("COMMIT");
    transactionOpen = false;

    const [deactivationResponse, movementResponse] = await Promise.all([
      deactivation,
      movement,
    ]);
    expectStatus(deactivationResponse, 200);
    assert.equal(deactivationResponse.body.data?.product?.isActive, false);
    assert.ok(
      movementResponse.status === 201 || movementResponse.status === 409,
      JSON.stringify(movementResponse.body),
    );
    if (movementResponse.status === 409) {
      expectError(movementResponse, 409, "PRODUCT_INACTIVE");
      assert.equal(await getStock(concurrencyProduct.id, warehouseIds[0]!), 2);
    } else {
      assert.equal(await getStock(concurrencyProduct.id, warehouseIds[0]!), 1);
    }
  } finally {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }
    client.release();
  }
});
