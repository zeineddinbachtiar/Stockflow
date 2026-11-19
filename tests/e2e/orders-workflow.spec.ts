import { randomUUID } from "node:crypto";

import { expect, request, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { Client } from "pg";

const E2E_DATABASE_NAME = "stockflow_test_db";
const E2E_SCHEMA_NAME = process.env.E2E_SCHEMA_NAME ?? "";
const API_BASE_URL = "http://127.0.0.1:3301/api/v1/";
const INITIAL_QUANTITY = 17;
const ORDER_QUANTITY = 4;

interface ApiEnvelope<T> {
  data: T;
}

interface CreatedEntity {
  id: string;
}

interface OrderStateRow {
  id: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  item_quantity: number;
  quantity_on_hand: number;
}

interface StockMovementRow {
  movement_type: "ORDER_CONFIRM" | "ORDER_CANCEL";
  quantity_delta: number;
}

interface E2EFixture {
  categoryId: string;
  productId: string;
  productSku: string;
  productName: string;
  warehouseId: string;
  warehouseCode: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  adminId: string;
}

let database: Client | undefined;
let api: APIRequestContext | undefined;
let fixture: E2EFixture | undefined;
let databaseConnected = false;
let databaseIdentityVerified = false;
let authorizationHeader = "";

async function createResource<T>(
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  if (!api) throw new Error("E2E API client is not initialized.");

  const response = await api.post(path, {
    data: payload,
    headers: { Authorization: authorizationHeader },
  });
  expect(response.status(), `Creating E2E resource at ${path}`).toBe(201);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

async function queryOrderState(orderId?: string): Promise<OrderStateRow> {
  if (!database || !fixture) {
    throw new Error("E2E database or fixture is not initialized.");
  }

  const result = await database.query<OrderStateRow>(
    `SELECT o.id,
            o.status,
            oi.quantity AS item_quantity,
            i.quantity_on_hand
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN inventory i
       ON i.warehouse_id = o.warehouse_id
      AND i.product_id = oi.product_id
     WHERE ($1::bigint IS NULL OR o.id = $1)
       AND o.customer_id = $2
       AND o.warehouse_id = $3
       AND oi.product_id = $4
       AND o.created_by = $5
     ORDER BY o.created_at DESC`,
    [
      orderId ?? null,
      fixture.customerId,
      fixture.warehouseId,
      fixture.productId,
      fixture.adminId,
    ],
  );

  expect(result.rowCount).toBe(1);
  const row = result.rows[0];
  if (!row) throw new Error("E2E order state was not found in PostgreSQL.");
  return row;
}

async function expectInventoryQuantity(expectedQuantity: number) {
  if (!api || !database || !fixture) {
    throw new Error("E2E clients or fixture are not initialized.");
  }

  const response = await api.get(
    `inventory?productId=${fixture.productId}&warehouseId=${fixture.warehouseId}`,
    { headers: { Authorization: authorizationHeader } },
  );
  expect(response.status()).toBe(200);

  const envelope = (await response.json()) as ApiEnvelope<{
    inventory: Array<{ quantityOnHand: number }>;
  }>;
  expect(envelope.data.inventory).toHaveLength(1);
  expect(envelope.data.inventory[0]?.quantityOnHand).toBe(expectedQuantity);

  const result = await database.query<{ quantity_on_hand: number }>(
    `SELECT quantity_on_hand
     FROM inventory
     WHERE product_id = $1 AND warehouse_id = $2`,
    [fixture.productId, fixture.warehouseId],
  );
  expect(result.rowCount).toBe(1);
  expect(result.rows[0]?.quantity_on_hand).toBe(expectedQuantity);
}

async function expectOrderMovements(
  orderId: string,
  expected: StockMovementRow[],
) {
  if (!database) throw new Error("E2E database is not initialized.");

  const result = await database.query<StockMovementRow>(
    `SELECT movement_type, quantity_delta
     FROM stock_movements
     WHERE order_id = $1
     ORDER BY movement_type`,
    [orderId],
  );
  expect(result.rows).toEqual(expected);
}

async function openOrderDetails(page: Page, customerName: string) {
  const orderRow = page.getByRole("row").filter({ hasText: customerName });
  await expect(orderRow).toHaveCount(1);
  await orderRow.getByRole("button", { name: "View" }).click();
  return page.getByRole("dialog", { name: "Order Detail" });
}

test.describe("Orders full-stack smoke workflow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    if (
      process.env.NODE_ENV !== "test" ||
      process.env.DB_NAME !== E2E_DATABASE_NAME ||
      !/^stockflow_e2e_[0-9a-f]{32}$/.test(E2E_SCHEMA_NAME) ||
      E2E_SCHEMA_NAME.length > 63
    ) {
      throw new Error(
        "E2E tests require a unique schema in the isolated stockflow_test_db.",
      );
    }

    const requiredVariables = [
      "DB_HOST",
      "DB_USER",
      "DB_PASSWORD",
      "SEED_ADMIN_PASSWORD",
    ];
    const missingVariables = requiredVariables.filter(
      (name) => !process.env[name]?.trim(),
    );
    if (missingVariables.length > 0) {
      throw new Error(
        `Missing E2E configuration: ${missingVariables.join(", ")}.`,
      );
    }

    database = new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? "5432"),
      database: E2E_DATABASE_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: `-c search_path=${E2E_SCHEMA_NAME}`,
      connectionTimeoutMillis: 5000,
      application_name: "stockflow-e2e-test",
    });
    await database.connect();
    databaseConnected = true;

    const identity = await database.query<{
      database_name: string;
      schema_name: string | null;
      search_path: string;
      schema_exists: boolean;
    }>(
      `SELECT current_database() AS database_name,
              current_schema() AS schema_name,
              current_setting('search_path') AS search_path,
              EXISTS (
                SELECT 1
                FROM information_schema.schemata
                WHERE schema_name = $1
              ) AS schema_exists`,
      [E2E_SCHEMA_NAME],
    );
    console.log("[E2E] Database guard:", JSON.stringify(identity.rows[0]));
    expect(identity.rows[0]?.database_name).toBe(E2E_DATABASE_NAME);
    expect(
      identity.rows[0]?.schema_name,
      "E2E schema must exist and be active on the database connection.",
    ).toBe(E2E_SCHEMA_NAME);
    databaseIdentityVerified =
      identity.rows[0]?.database_name === E2E_DATABASE_NAME &&
      identity.rows[0]?.schema_name === E2E_SCHEMA_NAME;

    api = await request.newContext({ baseURL: API_BASE_URL });

    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!adminPassword) {
      throw new Error("SEED_ADMIN_PASSWORD is required for the E2E account.");
    }

    const loginResponse = await api.post("auth/login", {
      data: {
        email: "admin@stockflow.local",
        password: adminPassword,
      },
    });
    expect(loginResponse.status(), "E2E ADMIN login should succeed.").toBe(200);

    const loginEnvelope = (await loginResponse.json()) as ApiEnvelope<{
      accessToken: string;
      user: { id: string; role: string };
    }>;
    expect(loginEnvelope.data.user.role).toBe("ADMIN");
    authorizationHeader = `Bearer ${loginEnvelope.data.accessToken}`;

    const suffix = randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
    const category = await createResource<{ category: CreatedEntity }>(
      "categories",
      {
        name: `E2E Category ${suffix}`,
        description: "Isolated full-stack E2E fixture.",
      },
    );
    const warehouse = await createResource<{ warehouse: CreatedEntity }>(
      "warehouses",
      {
        code: `E2E-W-${suffix}`,
        name: `E2E Warehouse ${suffix}`,
        address: "Isolated E2E fixture.",
      },
    );
    const product = await createResource<{
      product: CreatedEntity;
    }>("products", {
      categoryId: category.category.id,
      sku: `E2E-P-${suffix}`,
      name: `E2E Product ${suffix}`,
      description: "Active product created for the E2E workflow.",
      unitPrice: "100.00",
    });
    const customer = await createResource<{
      customer: CreatedEntity;
    }>("customers", {
      customerCode: `E2E-C-${suffix}`,
      name: `E2E Customer ${suffix}`,
      email: `e2e-${suffix.toLowerCase()}@example.test`,
      phone: "0000000000",
      address: "Isolated E2E fixture.",
    });
    fixture = {
      categoryId: category.category.id,
      productId: product.product.id,
      productSku: `E2E-P-${suffix}`,
      productName: `E2E Product ${suffix}`,
      warehouseId: warehouse.warehouse.id,
      warehouseCode: `E2E-W-${suffix}`,
      customerId: customer.customer.id,
      customerCode: `E2E-C-${suffix}`,
      customerName: `E2E Customer ${suffix}`,
      adminId: loginEnvelope.data.user.id,
    };

    const receiptResponse = await api.post("inventory/receipts", {
      data: {
        warehouseId: fixture.warehouseId,
        productId: fixture.productId,
        quantity: INITIAL_QUANTITY,
        reason: `E2E opening stock ${suffix}`,
      },
      headers: { Authorization: authorizationHeader },
    });
    expect(
      receiptResponse.status(),
      "E2E opening receipt should succeed.",
    ).toBe(201);

    const inventoryFixture = await database.query<{
      quantity_on_hand: number;
      product_is_active: boolean;
      warehouse_is_active: boolean;
    }>(
      `SELECT i.quantity_on_hand,
              p.is_active AS product_is_active,
              w.is_active AS warehouse_is_active
       FROM inventory i
       JOIN products p ON p.id = i.product_id
       JOIN warehouses w ON w.id = i.warehouse_id
       WHERE i.product_id = $1 AND i.warehouse_id = $2`,
      [fixture.productId, fixture.warehouseId],
    );
    expect(inventoryFixture.rowCount).toBe(1);
    expect(inventoryFixture.rows[0]).toEqual({
      quantity_on_hand: INITIAL_QUANTITY,
      product_is_active: true,
      warehouse_is_active: true,
    });
  });

  test.afterAll(async () => {
    try {
      if (database && databaseConnected && databaseIdentityVerified) {
        const identity = await database.query(
          "SELECT current_database() AS database_name, current_schema() AS schema_name",
        );
        if (
          identity.rows[0]?.database_name !== E2E_DATABASE_NAME ||
          identity.rows[0]?.schema_name !== E2E_SCHEMA_NAME
        ) {
          throw new Error("Refusing E2E cleanup outside its isolated schema.");
        }

        if (fixture && api) {
          const unfinishedOrders = await database.query<{
            id: string;
            status: "DRAFT" | "CONFIRMED" | "CANCELLED";
          }>(
            `SELECT id, status
             FROM orders
             WHERE customer_id = $1
               AND warehouse_id = $2
               AND created_by = $3
               AND status <> 'CANCELLED'`,
            [fixture.customerId, fixture.warehouseId, fixture.adminId],
          );

          for (const order of unfinishedOrders.rows) {
            const response = await api.post(`orders/${order.id}/cancel`, {
              headers: { Authorization: authorizationHeader },
            });
            expect(
              response.status(),
              "E2E cleanup should cancel unfinished fixture orders.",
            ).toBe(200);
          }
        }
      }
    } finally {
      if (database && databaseConnected) await database.end();
      await api?.dispose();
    }
  });

  test("ADMIN creates, confirms, and cancels an order with real stock restoration", async ({
    page,
  }) => {
    if (!fixture || !api || !database) {
      throw new Error("E2E fixture was not initialized.");
    }

    page.on("pageerror", (error) => {
      console.error("[E2E] Browser page error:", error.message);
    });
    page.on("requestfailed", (request) => {
      console.error(
        `[E2E] Browser request failed: ${request.method()} ${new URL(request.url()).pathname}`,
      );
    });

    await page.goto("/login");
    await page.getByLabel("Email address").fill("admin@stockflow.local");
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.SEED_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("link", { name: "Orders", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Orders", exact: true }).click();
    await expect(
      page
        .locator("#main-content")
        .getByRole("heading", { name: "Orders", exact: true }),
    ).toBeVisible();

    await expectInventoryQuantity(INITIAL_QUANTITY);
    await page.getByRole("button", { name: "Create Draft" }).click();

    const createDialog = page.getByRole("dialog", {
      name: "Create Draft Order",
    });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Customer").selectOption(fixture.customerId);
    await createDialog
      .getByLabel("Warehouse")
      .selectOption(fixture.warehouseId);
    await createDialog
      .getByRole("combobox")
      .nth(2)
      .selectOption(fixture.productId);
    await createDialog.getByLabel("Quantity").fill(String(ORDER_QUANTITY));
    await createDialog
      .getByRole("button", { name: "Create Draft", exact: true })
      .click();

    await expect(createDialog).toBeHidden();
    const draftRow = page
      .getByRole("row")
      .filter({ hasText: fixture.customerName });
    await expect(draftRow).toHaveCount(1);
    await expect(draftRow.getByText("DRAFT", { exact: true })).toBeVisible();

    const draftState = await queryOrderState();
    expect(draftState.status).toBe("DRAFT");
    expect(draftState.item_quantity).toBe(ORDER_QUANTITY);
    expect(draftState.quantity_on_hand).toBe(INITIAL_QUANTITY);
    const orderId = draftState.id;
    await expectInventoryQuantity(INITIAL_QUANTITY);

    const draftDetails = await openOrderDetails(page, fixture.customerName);
    await expect(
      draftDetails.getByText("DRAFT", { exact: true }),
    ).toBeVisible();
    await draftDetails
      .getByRole("button", { name: "Confirm Order", exact: true })
      .click();
    const confirmDialog = page.getByRole("dialog", {
      name: "Confirm this order?",
    });
    await confirmDialog
      .getByRole("button", { name: "Confirm order", exact: true })
      .click();

    const confirmedRow = page
      .getByRole("row")
      .filter({ hasText: fixture.customerName });
    await expect(
      confirmedRow.getByText("CONFIRMED", { exact: true }),
    ).toBeVisible();
    const confirmedState = await queryOrderState(orderId);
    expect(confirmedState.status).toBe("CONFIRMED");
    expect(confirmedState.quantity_on_hand).toBe(
      INITIAL_QUANTITY - ORDER_QUANTITY,
    );
    await expectInventoryQuantity(INITIAL_QUANTITY - ORDER_QUANTITY);
    await expectOrderMovements(orderId, [
      { movement_type: "ORDER_CONFIRM", quantity_delta: -ORDER_QUANTITY },
    ]);

    const confirmedDetails = await openOrderDetails(page, fixture.customerName);
    await expect(
      confirmedDetails.getByText("CONFIRMED", { exact: true }),
    ).toBeVisible();
    await confirmedDetails
      .getByRole("button", { name: "Cancel Order", exact: true })
      .click();
    const cancelDialog = page.getByRole("dialog", {
      name: "Cancel this order?",
    });
    await cancelDialog
      .getByRole("button", { name: "Cancel order", exact: true })
      .click();

    const cancelledRow = page
      .getByRole("row")
      .filter({ hasText: fixture.customerName });
    await expect(
      cancelledRow.getByText("CANCELLED", { exact: true }),
    ).toBeVisible();
    const cancelledState = await queryOrderState(orderId);
    expect(cancelledState.status).toBe("CANCELLED");
    expect(cancelledState.quantity_on_hand).toBe(INITIAL_QUANTITY);
    await expectInventoryQuantity(INITIAL_QUANTITY);
    await expectOrderMovements(orderId, [
      { movement_type: "ORDER_CANCEL", quantity_delta: ORDER_QUANTITY },
      { movement_type: "ORDER_CONFIRM", quantity_delta: -ORDER_QUANTITY },
    ]);
  });
});
