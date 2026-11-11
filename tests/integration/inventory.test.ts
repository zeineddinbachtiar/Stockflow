import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../../src/app";
import { env } from "../../src/config/env";
import { pool } from "../../src/config/database";

interface InventoryRecord {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseIsActive: boolean;
  productId: string;
  productSku: string;
  productName: string;
  productIsActive: boolean;
  quantityOnHand: number;
  reorderLevel: number;
  isLowStock: boolean;
}

interface MovementRecord {
  id: string;
  warehouseId: string;
  productId: string;
  performedBy: string;
  orderId: string | null;
  movementType: string;
  quantityDelta: number;
  reason: string | null;
}

const testReason = "Module 3 automated inventory test";

let adminToken = "";
let warehouseToken = "";
let salesToken = "";

let inventory: InventoryRecord | null = null;
let baselineQuantity = 0;
let expectedQuantity = 0;
let baselineReorderLevel = 0;

const movementIds: string[] = [];
const receiptMovementIds: string[] = [];
const adjustmentMovementIds: string[] = [];

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

  const body = response.body as {
    code?: string;
  };

  assert.equal(body.code, expectedCode, JSON.stringify(body));
}

function recordMovement(movement: MovementRecord): void {
  movementIds.push(movement.id);

  if (movement.movementType === "RECEIPT") {
    receiptMovementIds.push(movement.id);
  }

  if (movement.movementType === "ADJUSTMENT") {
    adjustmentMovementIds.push(movement.id);
  }
}

async function login(
  email: string,
  password: string | undefined,
  role: string,
): Promise<string> {
  assert.ok(password, `Password for ${role} is missing.`);

  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });

  expectStatus(response, 200);

  const token = response.body.data?.accessToken;
  const actualRole = response.body.data?.user?.role;

  assert.ok(token, "Access token is missing.");
  assert.equal(actualRole, role);

  return token as string;
}

async function getCurrentInventory(): Promise<InventoryRecord> {
  assert.ok(inventory, "Inventory fixture is not initialized.");

  const response = await request(app)
    .get(`/api/v1/inventory/${inventory.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 200);

  const current = response.body.data?.inventory as InventoryRecord | undefined;

  assert.ok(current, "Inventory detail is missing.");

  return current;
}

async function getMovementTotal(): Promise<number> {
  assert.ok(inventory, "Inventory fixture is not initialized.");

  const response = await request(app)
    .get("/api/v1/stock-movements")
    .query({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      limit: 1,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 200);

  return Number(response.body.data?.total);
}

// --------------------------------------------------
// SETUP
// --------------------------------------------------

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

  // Find the dedicated seeded inventory fixture.
  const response = await request(app)
    .get("/api/v1/inventory")
    .query({
      limit: 100,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 200);

  const items = response.body.data?.inventory as InventoryRecord[] | undefined;

  assert.ok(items, "Inventory list is missing.");

  const selected = items.find(
    (item) =>
      item.warehouseCode === "WH-JKT" &&
      item.productSku === "LAP-001" &&
      item.warehouseIsActive &&
      item.productIsActive,
  );

  assert.ok(
    selected,
    "Seeded inventory WH-JKT / LAP-001 was not found or is inactive.",
  );

  inventory = selected;

  baselineQuantity = selected.quantityOnHand;
  expectedQuantity = baselineQuantity;
  baselineReorderLevel = selected.reorderLevel;

  assert.ok(
    baselineQuantity >= 2,
    "Seeded inventory must contain at least 2 units for concurrency tests.",
  );
});

// --------------------------------------------------
// CLEANUP
// --------------------------------------------------

after(async () => {
  try {
    if (inventory && adminToken) {
      // Restore stock through the API, preserving the movement audit trail.
      const result = await pool.query<{
        quantity_on_hand: number;
      }>(
        `SELECT quantity_on_hand
         FROM inventory
         WHERE id = $1`,
        [inventory.id],
      );

      const currentQuantity = result.rows[0]?.quantity_on_hand;

      if (currentQuantity === undefined) {
        throw new Error(
          "Could not read inventory balance during test cleanup.",
        );
      }

      const quantityDelta = baselineQuantity - currentQuantity;

      if (quantityDelta !== 0) {
        const restoreResponse = await request(app)
          .post("/api/v1/inventory/adjustments")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            warehouseId: inventory.warehouseId,
            productId: inventory.productId,
            quantityDelta,
            reason: `${testReason} - restore original stock`,
          });

        assert.equal(
          restoreResponse.status,
          201,
          `Could not restore original stock: ${JSON.stringify(restoreResponse.body)}`,
        );
      }

      // Restore the original reorder level.
      const reorderResponse = await request(app)
        .patch(`/api/v1/inventory/${inventory.id}/reorder-level`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reorderLevel: baselineReorderLevel,
        });

      assert.equal(
        reorderResponse.status,
        200,
        `Could not restore reorder level: ${JSON.stringify(reorderResponse.body)}`,
      );
    }
  } finally {
    await pool.end();
  }
});

// --------------------------------------------------
// 1. INVENTORY READ ACCESS
// --------------------------------------------------

test("ADMIN, WAREHOUSE_STAFF, and SALES_STAFF can read inventory", async () => {
  for (const token of [adminToken, warehouseToken, salesToken]) {
    const response = await request(app)
      .get("/api/v1/inventory")
      .set("Authorization", `Bearer ${token}`);

    expectStatus(response, 200);
  }
});

test("inventory filtering returns the requested warehouse/product pair", async () => {
  assert.ok(inventory);

  const response = await request(app)
    .get("/api/v1/inventory")
    .query({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      limit: 10,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 200);

  const items = response.body.data?.inventory as InventoryRecord[] | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.id, inventory.id);
});

test("inventory pagination returns the requested page size", async () => {
  const response = await request(app)
    .get("/api/v1/inventory")
    .query({
      limit: 1,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 200);

  const items = response.body.data?.inventory as InventoryRecord[] | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
});

// --------------------------------------------------
// 2. ROLE-BASED ACCESS
// --------------------------------------------------

test("inventory requires authentication", async () => {
  const response = await request(app).get("/api/v1/inventory");

  expectError(response, 401, "AUTHENTICATION_REQUIRED");
});

test("only ADMIN and WAREHOUSE_STAFF can access stock movements", async () => {
  const adminResponse = await request(app)
    .get("/api/v1/stock-movements")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(adminResponse, 200);

  const warehouseResponse = await request(app)
    .get("/api/v1/stock-movements")
    .set("Authorization", `Bearer ${warehouseToken}`);

  expectStatus(warehouseResponse, 200);

  const salesResponse = await request(app)
    .get("/api/v1/stock-movements")
    .set("Authorization", `Bearer ${salesToken}`);

  expectError(salesResponse, 403, "FORBIDDEN");
});

test("SALES_STAFF cannot perform stock operations", async () => {
  assert.ok(inventory);

  const response = await request(app)
    .post("/api/v1/inventory/receipts")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      quantity: 1,
      reason: testReason,
    });

  expectError(response, 403, "FORBIDDEN");
});

// --------------------------------------------------
// 3. RECEIPT
// --------------------------------------------------

test("ADMIN can receive stock and create a RECEIPT movement", async () => {
  assert.ok(inventory);

  const response = await request(app)
    .post("/api/v1/inventory/receipts")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      quantity: 5,
      reason: `${testReason} - admin receipt`,
    });

  expectStatus(response, 201);

  const updated = response.body.data?.inventory as InventoryRecord | undefined;

  const movement = response.body.data?.movement as MovementRecord | undefined;

  assert.ok(updated);
  assert.ok(movement);

  expectedQuantity += 5;

  assert.equal(updated.quantityOnHand, expectedQuantity);
  assert.equal(movement.movementType, "RECEIPT");
  assert.equal(movement.quantityDelta, 5);
  assert.equal(movement.orderId, null);

  recordMovement(movement);
});

// --------------------------------------------------
// 4. ISSUE
// --------------------------------------------------

test("ADMIN can issue stock and record a negative ISSUE delta", async () => {
  assert.ok(inventory);

  const response = await request(app)
    .post("/api/v1/inventory/issues")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      quantity: 2,
      reason: `${testReason} - admin issue`,
    });

  expectStatus(response, 201);

  const updated = response.body.data?.inventory as InventoryRecord | undefined;

  const movement = response.body.data?.movement as MovementRecord | undefined;

  assert.ok(updated);
  assert.ok(movement);

  expectedQuantity -= 2;

  assert.equal(updated.quantityOnHand, expectedQuantity);
  assert.equal(movement.movementType, "ISSUE");
  assert.equal(movement.quantityDelta, -2);
  assert.equal(movement.orderId, null);

  recordMovement(movement);
});

// --------------------------------------------------
// 5. STOCK ADJUSTMENT
// --------------------------------------------------

test("ADMIN can perform positive and negative stock adjustments", async () => {
  assert.ok(inventory);

  const positiveResponse = await request(app)
    .post("/api/v1/inventory/adjustments")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      quantityDelta: 3,
      reason: `${testReason} - positive adjustment`,
    });

  expectStatus(positiveResponse, 201);

  const positiveInventory = positiveResponse.body.data?.inventory as
    InventoryRecord | undefined;

  const positiveMovement = positiveResponse.body.data?.movement as
    MovementRecord | undefined;

  assert.ok(positiveInventory);
  assert.ok(positiveMovement);

  expectedQuantity += 3;

  assert.equal(positiveInventory.quantityOnHand, expectedQuantity);

  assert.equal(positiveMovement.movementType, "ADJUSTMENT");

  assert.equal(positiveMovement.quantityDelta, 3);

  recordMovement(positiveMovement);

  const negativeResponse = await request(app)
    .post("/api/v1/inventory/adjustments")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      quantityDelta: -1,
      reason: `${testReason} - negative adjustment`,
    });

  expectStatus(negativeResponse, 201);

  const negativeInventory = negativeResponse.body.data?.inventory as
    InventoryRecord | undefined;

  const negativeMovement = negativeResponse.body.data?.movement as
    MovementRecord | undefined;

  assert.ok(negativeInventory);
  assert.ok(negativeMovement);

  expectedQuantity -= 1;

  assert.equal(negativeInventory.quantityOnHand, expectedQuantity);

  assert.equal(negativeMovement.movementType, "ADJUSTMENT");

  assert.equal(negativeMovement.quantityDelta, -1);

  recordMovement(negativeMovement);
});

// --------------------------------------------------
// 6. WAREHOUSE STAFF OPERATION
// --------------------------------------------------

test("WAREHOUSE_STAFF can receive stock", async () => {
  assert.ok(inventory);

  const response = await request(app)
    .post("/api/v1/inventory/receipts")
    .set("Authorization", `Bearer ${warehouseToken}`)
    .send({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      quantity: 2,
      reason: `${testReason} - warehouse receipt`,
    });

  expectStatus(response, 201);

  const updated = response.body.data?.inventory as InventoryRecord | undefined;

  const movement = response.body.data?.movement as MovementRecord | undefined;

  assert.ok(updated);
  assert.ok(movement);

  expectedQuantity += 2;

  assert.equal(updated.quantityOnHand, expectedQuantity);
  assert.equal(movement.movementType, "RECEIPT");
  assert.equal(movement.quantityDelta, 2);

  recordMovement(movement);
});

// --------------------------------------------------
// 7. VALIDATION AND TRANSACTION ATOMICITY
// --------------------------------------------------

test("invalid stock operations are rejected without changing stock or movement history", async () => {
  assert.ok(inventory);

  const quantityBefore = (await getCurrentInventory()).quantityOnHand;
  const movementsBefore = await getMovementTotal();

  const invalidReceipt = await request(app)
    .post("/api/v1/inventory/receipts")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      quantity: 0,
    });

  expectError(invalidReceipt, 400, "VALIDATION_ERROR");

  const invalidAdjustment = await request(app)
    .post("/api/v1/inventory/adjustments")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      quantityDelta: 0,
      reason: `${testReason} - invalid zero adjustment`,
    });

  expectError(invalidAdjustment, 400, "VALIDATION_ERROR");

  const extraFieldReceipt = await request(app)
    .post("/api/v1/inventory/receipts")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      quantity: 1,
      quantityOnHand: 999999,
    });

  expectError(extraFieldReceipt, 400, "VALIDATION_ERROR");

  const quantityAfter = (await getCurrentInventory()).quantityOnHand;
  const movementsAfter = await getMovementTotal();

  assert.equal(quantityAfter, quantityBefore);
  assert.equal(movementsAfter, movementsBefore);
});

test("issue that would make stock negative is rejected atomically", async () => {
  assert.ok(inventory);

  const quantityBefore = (await getCurrentInventory()).quantityOnHand;
  const movementsBefore = await getMovementTotal();

  const response = await request(app)
    .post("/api/v1/inventory/issues")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      quantity: 2147483647,
      reason: `${testReason} - insufficient stock`,
    });

  expectError(response, 409, "INSUFFICIENT_STOCK");

  const quantityAfter = (await getCurrentInventory()).quantityOnHand;
  const movementsAfter = await getMovementTotal();

  assert.equal(quantityAfter, quantityBefore);
  assert.equal(movementsAfter, movementsBefore);
});

// --------------------------------------------------
// 8. CONCURRENCY / ROW LOCKING
// --------------------------------------------------

test("concurrent issues cannot oversell the available stock", async () => {
  assert.ok(inventory);

  const quantityBefore = (await getCurrentInventory()).quantityOnHand;

  assert.ok(
    quantityBefore >= 2,
    "At least 2 units are required for the concurrency test.",
  );

  // Both requests together attempt to issue one unit more than available.
  const quantityA = Math.floor(quantityBefore / 2);
  const quantityB = quantityBefore - quantityA + 1;

  const [responseA, responseB] = await Promise.all([
    request(app)
      .post("/api/v1/inventory/issues")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        warehouseId: inventory.warehouseId,
        productId: inventory.productId,
        quantity: quantityA,
        reason: `${testReason} - concurrent issue A`,
      }),

    request(app)
      .post("/api/v1/inventory/issues")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        warehouseId: inventory.warehouseId,
        productId: inventory.productId,
        quantity: quantityB,
        reason: `${testReason} - concurrent issue B`,
      }),
  ]);

  const statuses = [responseA.status, responseB.status].sort((a, b) => a - b);

  assert.deepEqual(
    statuses,
    [201, 409],
    `Expected exactly one successful issue and one rejected issue. A=${JSON.stringify(responseA.body)} B=${JSON.stringify(responseB.body)}`,
  );

  const successfulResponse = responseA.status === 201 ? responseA : responseB;

  const failedResponse = responseA.status === 409 ? responseA : responseB;

  assert.equal(failedResponse.body.code, "INSUFFICIENT_STOCK");

  const updated = successfulResponse.body.data?.inventory as
    InventoryRecord | undefined;

  const movement = successfulResponse.body.data?.movement as
    MovementRecord | undefined;

  assert.ok(updated);
  assert.ok(movement);

  assert.equal(
    updated.quantityOnHand,
    quantityBefore - movement.quantityDelta * -1,
  );

  assert.ok(updated.quantityOnHand >= 0);

  expectedQuantity = updated.quantityOnHand;

  recordMovement(movement);

  const current = await getCurrentInventory();

  assert.equal(current.quantityOnHand, expectedQuantity);
});

// --------------------------------------------------
// 9. REORDER LEVEL AND LOW STOCK
// --------------------------------------------------

test("reorder level updates and low-stock filters work correctly", async () => {
  assert.ok(inventory);

  const current = await getCurrentInventory();

  const equalThresholdResponse = await request(app)
    .patch(`/api/v1/inventory/${inventory.id}/reorder-level`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      reorderLevel: current.quantityOnHand,
    });

  expectStatus(equalThresholdResponse, 200);

  const equalThresholdInventory = equalThresholdResponse.body.data
    ?.inventory as InventoryRecord | undefined;

  assert.ok(equalThresholdInventory);
  assert.equal(equalThresholdInventory.isLowStock, true);

  const lowStockResponse = await request(app)
    .get("/api/v1/inventory")
    .query({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      lowStock: "true",
      limit: 10,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(lowStockResponse, 200);

  const lowStockItems = lowStockResponse.body.data?.inventory as
    InventoryRecord[] | undefined;

  assert.ok(lowStockItems);
  assert.ok(lowStockItems.some((item) => item.id === inventory?.id));

  const lowerThreshold = Math.max(0, current.quantityOnHand - 1);

  const lowerThresholdResponse = await request(app)
    .patch(`/api/v1/inventory/${inventory.id}/reorder-level`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      reorderLevel: lowerThreshold,
    });

  expectStatus(lowerThresholdResponse, 200);

  const lowerThresholdInventory = lowerThresholdResponse.body.data
    ?.inventory as InventoryRecord | undefined;

  assert.ok(lowerThresholdInventory);
  assert.equal(lowerThresholdInventory.isLowStock, false);

  const stillLowResponse = await request(app)
    .get("/api/v1/inventory")
    .query({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      lowStock: "true",
      limit: 10,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(stillLowResponse, 200);

  const stillLowItems = stillLowResponse.body.data?.inventory as
    InventoryRecord[] | undefined;

  assert.ok(stillLowItems);
  assert.equal(
    stillLowItems.some((item) => item.id === inventory?.id),
    false,
  );

  const notLowResponse = await request(app)
    .get("/api/v1/inventory")
    .query({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      lowStock: "false",
      limit: 10,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(notLowResponse, 200);

  const notLowItems = notLowResponse.body.data?.inventory as
    InventoryRecord[] | undefined;

  assert.ok(notLowItems);
  assert.ok(notLowItems.some((item) => item.id === inventory?.id));
});

test("WAREHOUSE_STAFF can update reorder level but SALES_STAFF cannot", async () => {
  assert.ok(inventory);

  const current = await getCurrentInventory();

  const warehouseResponse = await request(app)
    .patch(`/api/v1/inventory/${inventory.id}/reorder-level`)
    .set("Authorization", `Bearer ${warehouseToken}`)
    .send({
      reorderLevel: current.reorderLevel,
    });

  expectStatus(warehouseResponse, 200);

  const salesResponse = await request(app)
    .patch(`/api/v1/inventory/${inventory.id}/reorder-level`)
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      reorderLevel: current.reorderLevel,
    });

  expectError(salesResponse, 403, "FORBIDDEN");
});

test("negative reorder level is rejected", async () => {
  assert.ok(inventory);

  const response = await request(app)
    .patch(`/api/v1/inventory/${inventory.id}/reorder-level`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      reorderLevel: -1,
    });

  expectError(response, 400, "VALIDATION_ERROR");
});

// --------------------------------------------------
// 10. STOCK MOVEMENT HISTORY
// --------------------------------------------------

test("stock movement history contains successful operations", async () => {
  assert.ok(inventory);
  assert.ok(movementIds.length > 0);

  const response = await request(app)
    .get("/api/v1/stock-movements")
    .query({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      limit: 100,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 200);

  const movements = response.body.data?.movements as
    MovementRecord[] | undefined;

  assert.ok(movements);

  for (const id of movementIds) {
    assert.ok(
      movements.some((movement) => movement.id === id),
      `Movement ${id} was not found in movement history.`,
    );
  }
});

test("stock movement filters return only the requested movement type", async () => {
  assert.ok(inventory);
  assert.ok(receiptMovementIds.length > 0);
  assert.ok(adjustmentMovementIds.length > 0);

  const receiptResponse = await request(app)
    .get("/api/v1/stock-movements")
    .query({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      movementType: "RECEIPT",
      limit: 100,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(receiptResponse, 200);

  const receiptItems = receiptResponse.body.data?.movements as
    MovementRecord[] | undefined;

  assert.ok(receiptItems);

  assert.ok(
    receiptItems.every((movement) => movement.movementType === "RECEIPT"),
  );

  for (const id of receiptMovementIds) {
    assert.ok(
      receiptItems.some((movement) => movement.id === id),
      `Receipt movement ${id} is missing from filtered history.`,
    );
  }

  const adjustmentResponse = await request(app)
    .get("/api/v1/stock-movements")
    .query({
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      movementType: "ADJUSTMENT",
      limit: 100,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(adjustmentResponse, 200);

  const adjustmentItems = adjustmentResponse.body.data?.movements as
    MovementRecord[] | undefined;

  assert.ok(adjustmentItems);

  assert.ok(
    adjustmentItems.every((movement) => movement.movementType === "ADJUSTMENT"),
  );

  for (const id of adjustmentMovementIds) {
    assert.ok(
      adjustmentItems.some((movement) => movement.id === id),
      `Adjustment movement ${id} is missing from filtered history.`,
    );
  }
});

test("stock movement detail returns the recorded audit information", async () => {
  const movementId = receiptMovementIds[0];

  assert.ok(movementId);

  const response = await request(app)
    .get(`/api/v1/stock-movements/${movementId}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 200);

  const movement = response.body.data?.movement as MovementRecord | undefined;

  assert.ok(movement);
  assert.equal(movement.id, movementId);
  assert.equal(movement.movementType, "RECEIPT");
  assert.equal(movement.quantityDelta, 5);
  assert.equal(movement.orderId, null);
  assert.ok(movement.performedBy);
  assert.ok(movement.reason?.includes(testReason));
});

// --------------------------------------------------
// 11. QUERY AND RESOURCE VALIDATION
// --------------------------------------------------

test("inventory rejects invalid lowStock query values", async () => {
  const response = await request(app)
    .get("/api/v1/inventory")
    .query({
      lowStock: "maybe",
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 400);
});

test("stock movements reject invalid movementType filters", async () => {
  const response = await request(app)
    .get("/api/v1/stock-movements")
    .query({
      movementType: "UNKNOWN",
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(response, 400);
});

test("nonexistent inventory and movement records return HTTP 404", async () => {
  const inventoryResponse = await request(app)
    .get("/api/v1/inventory/9223372036854775807")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(inventoryResponse, 404);

  const movementResponse = await request(app)
    .get("/api/v1/stock-movements/9223372036854775807")
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(movementResponse, 404, "STOCK_MOVEMENT_NOT_FOUND");
});
