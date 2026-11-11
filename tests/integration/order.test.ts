
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../../src/app";
import { env } from "../../src/config/env";
import { pool } from "../../src/config/database";

interface ProductFixture {
  id: string;
  sku: string;
  unitPrice: string;
  baselineQuantity: number;
}

interface OrderFixture {
  customerId: string;
  warehouseId: string;
  laptopOne: ProductFixture;
  laptopTwo: ProductFixture;
}

interface OrderItem {
  id: string;
  productId: string;
  productSku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

interface TestOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  warehouseId: string;
  createdBy: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  itemCount: number;
  totalAmount: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  items?: OrderItem[];
}

interface OrderMovement {
  id: string;
  order_id: string;
  warehouse_id: string;
  product_id: string;
  performed_by: string;
  movement_type: string;
  quantity_delta: number;
}

let adminToken = "";
let warehouseToken = "";
let salesToken = "";

let fixture: OrderFixture | null = null;

const createdOrderIds: string[] = [];

function getFixture(): OrderFixture {
  assert.ok(fixture, "Order test fixtures are not initialized.");
  return fixture;
}

function expectStatus(
  response: { status: number; body: unknown },
  expectedStatus: number
): void {
  assert.equal(
    response.status,
    expectedStatus,
    JSON.stringify(response.body)
  );
}

function expectError(
  response: { status: number; body: unknown },
  expectedStatus: number,
  expectedCode: string
): void {
  expectStatus(response, expectedStatus);

  const body = response.body as {
    code?: string;
  };

  assert.equal(
    body.code,
    expectedCode,
    JSON.stringify(body)
  );
}

function getOrder(
  response: { body: unknown }
): TestOrder {
  const body = response.body as {
    data?: {
      order?: TestOrder;
    };
  };

  const order = body.data?.order;

  assert.ok(order, "Order response data is missing.");

  return order;
}

async function login(
  email: string,
  password: string | undefined,
  expectedRole: string
): Promise<string> {
  assert.ok(password, `Password for ${expectedRole} is missing.`);

  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });

  expectStatus(response, 200);

  const accessToken = response.body.data?.accessToken;
  const role = response.body.data?.user?.role;

  assert.ok(accessToken, "Access token is missing.");
  assert.equal(role, expectedRole);

  return accessToken as string;
}

async function createOrder(
  token: string,
  items: Array<{
    productId: string;
    quantity: number;
  }>
): Promise<TestOrder> {
  const current = getFixture();

  const response = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${token}`)
    .send({
      customerId: current.customerId,
      warehouseId: current.warehouseId,
      items
    });

  expectStatus(response, 201);

  const order = getOrder(response);

  createdOrderIds.push(order.id);

  return order;
}

async function getStock(productId: string): Promise<number> {
  const current = getFixture();

  const result = await pool.query<{
    quantity_on_hand: number;
  }>(
    `SELECT quantity_on_hand
     FROM inventory
     WHERE warehouse_id = $1
       AND product_id = $2`,
    [current.warehouseId, productId]
  );

  assert.equal(
    result.rowCount,
    1,
    `Inventory row not found for product ${productId}.`
  );

  return result.rows[0]!.quantity_on_hand;
}

async function getOrderMovements(
  orderId: string
): Promise<OrderMovement[]> {
  const result = await pool.query<OrderMovement>(
    `SELECT
       id,
       order_id,
       warehouse_id,
       product_id,
       performed_by,
       movement_type,
       quantity_delta
     FROM stock_movements
     WHERE order_id = $1
     ORDER BY id ASC`,
    [orderId]
  );

  return result.rows;
}

// --------------------------------------------------
// SETUP
// --------------------------------------------------

before(async () => {
  adminToken = await login(
    "admin@stockflow.local",
    env.SEED_ADMIN_PASSWORD,
    "ADMIN"
  );

  warehouseToken = await login(
    "warehouse@stockflow.local",
    env.SEED_WAREHOUSE_PASSWORD,
    "WAREHOUSE_STAFF"
  );

  salesToken = await login(
    "sales@stockflow.local",
    env.SEED_SALES_PASSWORD,
    "SALES_STAFF"
  );

  const customerResult = await pool.query<{
    id: string;
  }>(
    `SELECT id
     FROM customers
     WHERE customer_code = 'CUST-001'`
  );

  const warehouseResult = await pool.query<{
    id: string;
  }>(
    `SELECT id
     FROM warehouses
     WHERE code = 'WH-JKT'
       AND is_active = TRUE`
  );

  const productResult = await pool.query<{
    id: string;
    sku: string;
    unit_price: string;
    quantity_on_hand: number;
  }>(
    `SELECT
       p.id,
       p.sku,
       p.unit_price::text AS unit_price,
       i.quantity_on_hand
     FROM products p
     INNER JOIN inventory i
       ON i.product_id = p.id
     INNER JOIN warehouses w
       ON w.id = i.warehouse_id
     WHERE w.code = 'WH-JKT'
       AND w.is_active = TRUE
       AND p.sku = ANY($1::text[])
       AND p.is_active = TRUE
     ORDER BY p.sku ASC`,
    [["LAP-001", "LAP-002"]]
  );

  const customer = customerResult.rows[0];
  const warehouse = warehouseResult.rows[0];

  assert.ok(customer, "Seed customer CUST-001 is missing.");
  assert.ok(warehouse, "Active warehouse WH-JKT is missing.");

  const laptopOne = productResult.rows.find(
    (product) => product.sku === "LAP-001"
  );

  const laptopTwo = productResult.rows.find(
    (product) => product.sku === "LAP-002"
  );

  assert.ok(laptopOne, "Seed product LAP-001 is missing.");
  assert.ok(laptopTwo, "Seed product LAP-002 is missing.");

  assert.ok(
    laptopOne.quantity_on_hand >= 3,
    "LAP-001 must have at least 3 units."
  );

  assert.ok(
    laptopTwo.quantity_on_hand >= 2,
    "LAP-002 must have at least 2 units."
  );

  fixture = {
    customerId: customer.id,
    warehouseId: warehouse.id,
    laptopOne: {
      id: laptopOne.id,
      sku: laptopOne.sku,
      unitPrice: laptopOne.unit_price,
      baselineQuantity: laptopOne.quantity_on_hand
    },
    laptopTwo: {
      id: laptopTwo.id,
      sku: laptopTwo.sku,
      unitPrice: laptopTwo.unit_price,
      baselineQuantity: laptopTwo.quantity_on_hand
    }
  };
});

// --------------------------------------------------
// CLEANUP
// --------------------------------------------------

after(async () => {
  try {
    // Orders and stock movements are retained as audit history.
    // Any test order that was not cancelled is cancelled through the API.
    for (const orderId of createdOrderIds) {
      const detailResponse = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      if (detailResponse.status === 404) {
        continue;
      }

      assert.equal(
        detailResponse.status,
        200,
        `Could not read order ${orderId} during cleanup.`
      );

      const order = getOrder(detailResponse);

      if (order.status !== "CANCELLED") {
        const cancelResponse = await request(app)
          .post(`/api/v1/orders/${orderId}/cancel`)
          .set("Authorization", `Bearer ${adminToken}`);

        assert.equal(
          cancelResponse.status,
          200,
          `Could not cancel order ${orderId}: ${JSON.stringify(cancelResponse.body)}`
        );
      }
    }

    if (fixture) {
      const laptopOneFinal = await getStock(
        fixture.laptopOne.id
      );

      const laptopTwoFinal = await getStock(
        fixture.laptopTwo.id
      );

      assert.equal(
        laptopOneFinal,
        fixture.laptopOne.baselineQuantity,
        "LAP-001 stock was not restored to its original balance."
      );

      assert.equal(
        laptopTwoFinal,
        fixture.laptopTwo.baselineQuantity,
        "LAP-002 stock was not restored to its original balance."
      );
    }
  } finally {
    await pool.end();
  }
});

// --------------------------------------------------
// 1. READ ACCESS AND AUTHORIZATION
// --------------------------------------------------

test("ADMIN, WAREHOUSE_STAFF, and SALES_STAFF can list orders", async () => {
  for (const token of [
    adminToken,
    warehouseToken,
    salesToken
  ]) {
    const response = await request(app)
      .get("/api/v1/orders")
      .set("Authorization", `Bearer ${token}`);

    expectStatus(response, 200);

    assert.ok(Array.isArray(response.body.data?.orders));
  }
});

test("orders require authentication", async () => {
  const response = await request(app)
    .get("/api/v1/orders");

  expectError(
    response,
    401,
    "AUTHENTICATION_REQUIRED"
  );
});

test("WAREHOUSE_STAFF cannot create an order", async () => {
  const current = getFixture();

  const response = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${warehouseToken}`)
    .send({
      customerId: current.customerId,
      warehouseId: current.warehouseId,
      items: [
        {
          productId: current.laptopOne.id,
          quantity: 1
        }
      ]
    });

  expectError(response, 403, "FORBIDDEN");
});

// --------------------------------------------------
// 2. CREATE ORDER VALIDATION
// --------------------------------------------------

test("order creation rejects empty items", async () => {
  const current = getFixture();

  const response = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerId: current.customerId,
      warehouseId: current.warehouseId,
      items: []
    });

  expectError(
    response,
    400,
    "VALIDATION_ERROR"
  );
});

test("order creation rejects duplicate products", async () => {
  const current = getFixture();

  const response = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerId: current.customerId,
      warehouseId: current.warehouseId,
      items: [
        {
          productId: current.laptopOne.id,
          quantity: 1
        },
        {
          productId: current.laptopOne.id,
          quantity: 2
        }
      ]
    });

  expectError(
    response,
    400,
    "VALIDATION_ERROR"
  );
});

test("order creation rejects zero quantity", async () => {
  const current = getFixture();

  const response = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerId: current.customerId,
      warehouseId: current.warehouseId,
      items: [
        {
          productId: current.laptopOne.id,
          quantity: 0
        }
      ]
    });

  expectError(
    response,
    400,
    "VALIDATION_ERROR"
  );
});

test("client cannot submit its own unit price", async () => {
  const current = getFixture();

  const response = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerId: current.customerId,
      warehouseId: current.warehouseId,
      items: [
        {
          productId: current.laptopOne.id,
          quantity: 1,
          unitPrice: "1.00"
        }
      ]
    });

  expectError(
    response,
    400,
    "VALIDATION_ERROR"
  );
});

// --------------------------------------------------
// 3. CREATE DRAFT AND PRICE SNAPSHOT
// --------------------------------------------------

let primaryOrder: TestOrder | null = null;

test("SALES_STAFF can create a DRAFT order without changing stock", async () => {
  const current = getFixture();

  const stockOneBefore = await getStock(current.laptopOne.id);
  const stockTwoBefore = await getStock(current.laptopTwo.id);

  const order = await createOrder(salesToken, [
    {
      productId: current.laptopOne.id,
      quantity: 2
    },
    {
      productId: current.laptopTwo.id,
      quantity: 1
    }
  ]);

  primaryOrder = order;

  assert.equal(order.status, "DRAFT");
  assert.equal(order.itemCount, 2);
  assert.equal(order.items?.length, 2);
  assert.equal(order.customerId, current.customerId);
  assert.equal(order.warehouseId, current.warehouseId);
  assert.equal(order.confirmedAt, null);
  assert.equal(order.cancelledAt, null);

  const firstItem = order.items?.find(
    (item) => item.productId === current.laptopOne.id
  );

  const secondItem = order.items?.find(
    (item) => item.productId === current.laptopTwo.id
  );

  assert.ok(firstItem);
  assert.ok(secondItem);

  assert.equal(firstItem.unitPrice, current.laptopOne.unitPrice);
  assert.equal(secondItem.unitPrice, current.laptopTwo.unitPrice);

  const expectedTotal =
    Number(current.laptopOne.unitPrice) * 2 +
    Number(current.laptopTwo.unitPrice);

  assert.equal(Number(order.totalAmount), expectedTotal);

  assert.equal(
    await getStock(current.laptopOne.id),
    stockOneBefore
  );

  assert.equal(
    await getStock(current.laptopTwo.id),
    stockTwoBefore
  );

  const movements = await getOrderMovements(order.id);

  assert.equal(
    movements.length,
    0,
    "Draft order must not generate stock movements."
  );
});

// --------------------------------------------------
// 4. UPDATE DRAFT
// --------------------------------------------------

test("owner can update a DRAFT order and recalculate its items", async () => {
  assert.ok(primaryOrder);

  const current = getFixture();

  const response = await request(app)
    .patch(`/api/v1/orders/${primaryOrder.id}`)
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      items: [
        {
          productId: current.laptopOne.id,
          quantity: 3
        },
        {
          productId: current.laptopTwo.id,
          quantity: 2
        }
      ]
    });

  expectStatus(response, 200);

  const updated = getOrder(response);

  assert.equal(updated.id, primaryOrder.id);
  assert.equal(updated.status, "DRAFT");
  assert.equal(updated.itemCount, 2);

  const firstItem = updated.items?.find(
    (item) => item.productId === current.laptopOne.id
  );

  const secondItem = updated.items?.find(
    (item) => item.productId === current.laptopTwo.id
  );

  assert.ok(firstItem);
  assert.ok(secondItem);

  assert.equal(firstItem.quantity, 3);
  assert.equal(secondItem.quantity, 2);

  assert.equal(
    Number(updated.totalAmount),
    Number(current.laptopOne.unitPrice) * 3 +
      Number(current.laptopTwo.unitPrice) * 2
  );

  assert.equal(
    (await getOrderMovements(updated.id)).length,
    0
  );

  primaryOrder = updated;
});

test("empty order update is rejected", async () => {
  assert.ok(primaryOrder);

  const response = await request(app)
    .patch(`/api/v1/orders/${primaryOrder.id}`)
    .set("Authorization", `Bearer ${salesToken}`)
    .send({});

  expectError(
    response,
    400,
    "VALIDATION_ERROR"
  );
});

// --------------------------------------------------
// 5. ORDER OWNERSHIP
// --------------------------------------------------

let adminOrder: TestOrder | null = null;

test("ADMIN can create an order and SALES_STAFF cannot access another user's order", async () => {
  const current = getFixture();

  adminOrder = await createOrder(adminToken, [
    {
      productId: current.laptopOne.id,
      quantity: 1
    }
  ]);

  assert.equal(adminOrder.status, "DRAFT");

  const detailResponse = await request(app)
    .get(`/api/v1/orders/${adminOrder.id}`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectError(
    detailResponse,
    404,
    "ORDER_NOT_FOUND"
  );

  const updateResponse = await request(app)
    .patch(`/api/v1/orders/${adminOrder.id}`)
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      items: [
        {
          productId: current.laptopOne.id,
          quantity: 2
        }
      ]
    });

  expectError(
    updateResponse,
    404,
    "ORDER_NOT_FOUND"
  );

  const cancelResponse = await request(app)
    .post(`/api/v1/orders/${adminOrder.id}/cancel`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectError(
    cancelResponse,
    404,
    "ORDER_NOT_FOUND"
  );
});

test("SALES_STAFF order list only includes its own orders", async () => {
  assert.ok(adminOrder);
  assert.ok(primaryOrder);

  const salesResponse = await request(app)
    .get("/api/v1/orders")
    .query({
      limit: 100,
      offset: 0
    })
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(salesResponse, 200);

  const salesOrders = salesResponse.body.data?.orders as
    | TestOrder[]
    | undefined;

  assert.ok(salesOrders);

  assert.ok(
    salesOrders.some((order) => order.id === primaryOrder?.id)
  );

  assert.equal(
    salesOrders.some((order) => order.id === adminOrder?.id),
    false
  );

  const adminResponse = await request(app)
    .get("/api/v1/orders")
    .query({
      limit: 100,
      offset: 0
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(adminResponse, 200);

  const adminOrders = adminResponse.body.data?.orders as
    | TestOrder[]
    | undefined;

  assert.ok(adminOrders);

  assert.ok(
    adminOrders.some((order) => order.id === adminOrder?.id)
  );
});

// --------------------------------------------------
// 6. ORDER RESOURCE VALIDATION
// --------------------------------------------------

test("nonexistent customer is rejected", async () => {
  const current = getFixture();

  const response = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerId: "9223372036854775807",
      warehouseId: current.warehouseId,
      items: [
        {
          productId: current.laptopOne.id,
          quantity: 1
        }
      ]
    });

  expectError(
    response,
    404,
    "CUSTOMER_NOT_FOUND"
  );
});

test("nonexistent warehouse is rejected", async () => {
  const current = getFixture();

  const response = await request(app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerId: current.customerId,
      warehouseId: "9223372036854775807",
      items: [
        {
          productId: current.laptopOne.id,
          quantity: 1
        }
      ]
    });

  expectError(
    response,
    404,
    "WAREHOUSE_NOT_FOUND"
  );
});

// --------------------------------------------------
// 7. FAILED CONFIRMATION ATOMICITY
// --------------------------------------------------

let insufficientStockOrder: TestOrder | null = null;

test("insufficient stock confirmation leaves the order and inventory unchanged", async () => {
  const current = getFixture();

  const stockOneBefore = await getStock(current.laptopOne.id);
  const stockTwoBefore = await getStock(current.laptopTwo.id);

  insufficientStockOrder = await createOrder(salesToken, [
    {
      productId: current.laptopOne.id,
      quantity: stockOneBefore + 1
    },
    {
      productId: current.laptopTwo.id,
      quantity: 1
    }
  ]);

  const confirmResponse = await request(app)
    .post(
      `/api/v1/orders/${insufficientStockOrder.id}/confirm`
    )
    .set("Authorization", `Bearer ${warehouseToken}`);

  expectError(
    confirmResponse,
    409,
    "INSUFFICIENT_STOCK"
  );

  const detailResponse = await request(app)
    .get(`/api/v1/orders/${insufficientStockOrder.id}`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(detailResponse, 200);

  const unchangedOrder = getOrder(detailResponse);

  assert.equal(unchangedOrder.status, "DRAFT");
  assert.equal(unchangedOrder.confirmedAt, null);

  assert.equal(
    await getStock(current.laptopOne.id),
    stockOneBefore
  );

  assert.equal(
    await getStock(current.laptopTwo.id),
    stockTwoBefore
  );

  assert.equal(
    (await getOrderMovements(insufficientStockOrder.id)).length,
    0
  );
});

test("owner can cancel a DRAFT order without restoring or changing stock", async () => {
  assert.ok(insufficientStockOrder);

  const current = getFixture();

  const stockOneBefore = await getStock(current.laptopOne.id);
  const stockTwoBefore = await getStock(current.laptopTwo.id);

  const response = await request(app)
    .post(
      `/api/v1/orders/${insufficientStockOrder.id}/cancel`
    )
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(response, 200);

  const cancelled = getOrder(response);

  assert.equal(cancelled.status, "CANCELLED");
  assert.ok(cancelled.cancelledAt);

  assert.equal(
    await getStock(current.laptopOne.id),
    stockOneBefore
  );

  assert.equal(
    await getStock(current.laptopTwo.id),
    stockTwoBefore
  );

  assert.equal(
    (await getOrderMovements(insufficientStockOrder.id)).length,
    0
  );
});

// --------------------------------------------------
// 8. CONFIRMATION AND STOCK DEDUCTION
// --------------------------------------------------

test("WAREHOUSE_STAFF can confirm an order and stock is deducted atomically", async () => {
  assert.ok(primaryOrder);

  const current = getFixture();

  const stockOneBefore = await getStock(current.laptopOne.id);
  const stockTwoBefore = await getStock(current.laptopTwo.id);

  assert.equal(
    stockOneBefore,
    current.laptopOne.baselineQuantity
  );

  assert.equal(
    stockTwoBefore,
    current.laptopTwo.baselineQuantity
  );

  const response = await request(app)
    .post(`/api/v1/orders/${primaryOrder.id}/confirm`)
    .set("Authorization", `Bearer ${warehouseToken}`);

  expectStatus(response, 200);

  const confirmed = getOrder(response);

  assert.equal(confirmed.status, "CONFIRMED");
  assert.ok(confirmed.confirmedAt);
  assert.equal(confirmed.cancelledAt, null);

  assert.equal(
    await getStock(current.laptopOne.id),
    stockOneBefore - 3
  );

  assert.equal(
    await getStock(current.laptopTwo.id),
    stockTwoBefore - 2
  );

  const movements = await getOrderMovements(primaryOrder.id);

  assert.equal(movements.length, 2);

  const firstMovement = movements.find(
    (movement) => movement.product_id === current.laptopOne.id
  );

  const secondMovement = movements.find(
    (movement) => movement.product_id === current.laptopTwo.id
  );

  assert.ok(firstMovement);
  assert.ok(secondMovement);

  for (const movement of movements) {
    assert.equal(movement.order_id, primaryOrder.id);
    assert.equal(movement.warehouse_id, current.warehouseId);
    assert.equal(movement.movement_type, "ORDER_CONFIRM");
    assert.ok(movement.performed_by);
  }

  assert.equal(firstMovement.quantity_delta, -3);
  assert.equal(secondMovement.quantity_delta, -2);
});

test("SALES_STAFF cannot confirm an order", async () => {
  assert.ok(adminOrder);

  const response = await request(app)
    .post(`/api/v1/orders/${adminOrder.id}/confirm`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectError(
    response,
    403,
    "FORBIDDEN"
  );
});

test("confirmed order cannot be updated or confirmed a second time", async () => {
  assert.ok(primaryOrder);

  const current = getFixture();

  const updateResponse = await request(app)
    .patch(`/api/v1/orders/${primaryOrder.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      items: [
        {
          productId: current.laptopOne.id,
          quantity: 1
        }
      ]
    });

  expectError(
    updateResponse,
    409,
    "ORDER_NOT_DRAFT"
  );

  const confirmResponse = await request(app)
    .post(`/api/v1/orders/${primaryOrder.id}/confirm`)
    .set("Authorization", `Bearer ${warehouseToken}`);

  expectError(
    confirmResponse,
    409,
    "ORDER_NOT_DRAFT"
  );
});

// --------------------------------------------------
// 9. CANCEL CONFIRMED ORDER AND RESTORE STOCK
// --------------------------------------------------

test("only ADMIN or WAREHOUSE_STAFF can cancel a CONFIRMED order", async () => {
  assert.ok(primaryOrder);

  const response = await request(app)
    .post(`/api/v1/orders/${primaryOrder.id}/cancel`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(response, 403);
});

test("WAREHOUSE_STAFF can cancel a CONFIRMED order and restore stock", async () => {
  assert.ok(primaryOrder);

  const current = getFixture();

  const response = await request(app)
    .post(`/api/v1/orders/${primaryOrder.id}/cancel`)
    .set("Authorization", `Bearer ${warehouseToken}`);

  expectStatus(response, 200);

  const cancelled = getOrder(response);

  assert.equal(cancelled.status, "CANCELLED");
  assert.ok(cancelled.cancelledAt);

  assert.equal(
    await getStock(current.laptopOne.id),
    current.laptopOne.baselineQuantity
  );

  assert.equal(
    await getStock(current.laptopTwo.id),
    current.laptopTwo.baselineQuantity
  );

  const movements = await getOrderMovements(primaryOrder.id);

  assert.equal(movements.length, 4);

  const confirmMovements = movements.filter(
    (movement) => movement.movement_type === "ORDER_CONFIRM"
  );

  const cancelMovements = movements.filter(
    (movement) => movement.movement_type === "ORDER_CANCEL"
  );

  assert.equal(confirmMovements.length, 2);
  assert.equal(cancelMovements.length, 2);

  const firstCancel = cancelMovements.find(
    (movement) => movement.product_id === current.laptopOne.id
  );

  const secondCancel = cancelMovements.find(
    (movement) => movement.product_id === current.laptopTwo.id
  );

  assert.ok(firstCancel);
  assert.ok(secondCancel);

  assert.equal(firstCancel.quantity_delta, 3);
  assert.equal(secondCancel.quantity_delta, 2);
});

test("already cancelled order cannot be cancelled again", async () => {
  assert.ok(primaryOrder);

  const response = await request(app)
    .post(`/api/v1/orders/${primaryOrder.id}/cancel`)
    .set("Authorization", `Bearer ${warehouseToken}`);

  expectError(
    response,
    409,
    "ORDER_ALREADY_CANCELLED"
  );
});

test("cancelled order cannot be updated", async () => {
  assert.ok(primaryOrder);

  const current = getFixture();

  const response = await request(app)
    .patch(`/api/v1/orders/${primaryOrder.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      items: [
        {
          productId: current.laptopOne.id,
          quantity: 1
        }
      ]
    });

  expectError(
    response,
    409,
    "ORDER_NOT_DRAFT"
  );
});

// --------------------------------------------------
// 10. CONCURRENT CONFIRMATION
// --------------------------------------------------

test("concurrent confirmation cannot deduct stock twice", async () => {
  const current = getFixture();

  const stockBefore = await getStock(current.laptopOne.id);

  const order = await createOrder(salesToken, [
    {
      productId: current.laptopOne.id,
      quantity: 1
    }
  ]);

  const [responseA, responseB] = await Promise.all([
    request(app)
      .post(`/api/v1/orders/${order.id}/confirm`)
      .set("Authorization", `Bearer ${warehouseToken}`),

    request(app)
      .post(`/api/v1/orders/${order.id}/confirm`)
      .set("Authorization", `Bearer ${warehouseToken}`)
  ]);

  const statuses = [
    responseA.status,
    responseB.status
  ].sort((a, b) => a - b);

  assert.deepEqual(
    statuses,
    [200, 409],
    `Expected exactly one confirmation: A=${JSON.stringify(responseA.body)} B=${JSON.stringify(responseB.body)}`
  );

  const failedResponse =
    responseA.status === 409 ? responseA : responseB;

  expectError(
    failedResponse,
    409,
    "ORDER_NOT_DRAFT"
  );

  const successfulResponse =
    responseA.status === 200 ? responseA : responseB;

  const confirmed = getOrder(successfulResponse);

  assert.equal(confirmed.status, "CONFIRMED");

  assert.equal(
    await getStock(current.laptopOne.id),
    stockBefore - 1
  );

  const movements = await getOrderMovements(order.id);

  assert.equal(movements.length, 1);
  assert.equal(movements[0]?.movement_type, "ORDER_CONFIRM");
  assert.equal(movements[0]?.quantity_delta, -1);

  const cancelResponse = await request(app)
    .post(`/api/v1/orders/${order.id}/cancel`)
    .set("Authorization", `Bearer ${warehouseToken}`);

  expectStatus(cancelResponse, 200);

  assert.equal(
    await getStock(current.laptopOne.id),
    stockBefore
  );

  const finalMovements = await getOrderMovements(order.id);

  assert.equal(finalMovements.length, 2);

  assert.equal(
    finalMovements.filter(
      (movement) => movement.movement_type === "ORDER_CONFIRM"
    ).length,
    1
  );

  assert.equal(
    finalMovements.filter(
      (movement) => movement.movement_type === "ORDER_CANCEL"
    ).length,
    1
  );
});

// --------------------------------------------------
// 11. ORDER FILTERS AND PAGINATION
// --------------------------------------------------

test("orders can be filtered by status", async () => {
  for (const status of [
    "DRAFT",
    "CONFIRMED",
    "CANCELLED"
  ]) {
    const response = await request(app)
      .get("/api/v1/orders")
      .query({
        status,
        limit: 100,
        offset: 0
      })
      .set("Authorization", `Bearer ${adminToken}`);

    expectStatus(response, 200);

    const orders = response.body.data?.orders as
      | TestOrder[]
      | undefined;

    assert.ok(orders);

    assert.ok(
      orders.every((order) => order.status === status),
      `Order status filter ${status} returned an unexpected status.`
    );
  }
});

test("invalid order query parameters are rejected", async () => {
  const response = await request(app)
    .get("/api/v1/orders")
    .query({
      status: "INVALID_STATUS"
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(
    response,
    400,
    "VALIDATION_ERROR"
  );
});

// --------------------------------------------------
// 12. ORDER DETAIL AND ID VALIDATION
// --------------------------------------------------

test("order detail returns the order and its items", async () => {
  assert.ok(primaryOrder);

  const response = await request(app)
    .get(`/api/v1/orders/${primaryOrder.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 200);

  const order = getOrder(response);

  assert.equal(order.id, primaryOrder.id);
  assert.equal(order.status, "CANCELLED");
  assert.ok(Array.isArray(order.items));
  assert.equal(order.items?.length, 2);
});

test("invalid order ID is rejected", async () => {
  const response = await request(app)
    .get("/api/v1/orders/not-a-number")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 400);
});

test("nonexistent order returns HTTP 404", async () => {
  const response = await request(app)
    .get("/api/v1/orders/9223372036854775807")
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(
    response,
    404,
    "ORDER_NOT_FOUND"
  );
});
