
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../../src/app";
import { env } from "../../src/config/env";
import { pool } from "../../src/config/database";

interface CategoryResource {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface ProductResource {
  id: string;
  categoryId: string;
  sku: string;
  name: string;
  unitPrice: string;
  isActive: boolean;
}

interface WarehouseResource {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
}

interface CustomerResource {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

const runId = randomUUID();

let adminToken = "";
let salesToken = "";
let warehouseToken = "";

// IDs of records created by these tests.
// They are deleted from the test database in the after hook.
const createdCategoryIds: string[] = [];
const createdProductIds: string[] = [];
const createdWarehouseIds: string[] = [];
const createdCustomerIds: string[] = [];

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

function getResource<T>(
  response: { body: unknown },
  key: string
): T {
  const body = response.body as {
    data?: Record<string, unknown>;
  };

  assert.ok(body.data, "Response data is missing.");

  const resource = body.data[key];

  assert.ok(
    resource && typeof resource === "object",
    `Response resource "${key}" is missing.`
  );

  return resource as T;
}

async function login(
  email: string,
  password: string | undefined,
  expectedRole: string
): Promise<string> {
  assert.ok(
    password,
    `Password for ${expectedRole} is not configured.`
  );

  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });

  expectStatus(response, 200);

  const body = response.body as {
    data?: {
      accessToken?: string;
      user?: {
        role?: string;
      };
    };
  };

  const accessToken = body.data?.accessToken;
  const role = body.data?.user?.role;

  assert.ok(accessToken, "Access token is missing.");
  assert.equal(role, expectedRole);

  return accessToken;
}


async function createCategoryFixture(): Promise<CategoryResource> {
  const response = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `M3 Product Category ${randomUUID()}`,
      description: "Category fixture for automated tests."
    });

  expectStatus(response, 201);

  const category = getResource<CategoryResource>(
    response,
    "category"
  );

  createdCategoryIds.push(category.id);

  return category;
}


// --------------------------------------------------
// SETUP AND CLEANUP
// --------------------------------------------------

before(async () => {
  adminToken = await login(
    "admin@stockflow.local",
    env.SEED_ADMIN_PASSWORD,
    "ADMIN"
  );

  salesToken = await login(
    "sales@stockflow.local",
    env.SEED_SALES_PASSWORD,
    "SALES_STAFF"
  );

  warehouseToken = await login(
    "warehouse@stockflow.local",
    env.SEED_WAREHOUSE_PASSWORD,
    "WAREHOUSE_STAFF"
  );
});

after(async () => {
  try {
    // Delete dependent product records first.
    if (createdProductIds.length > 0) {
      await pool.query(
        "DELETE FROM products WHERE id::text = ANY($1::text[])",
        [createdProductIds]
      );
    }

    if (createdCategoryIds.length > 0) {
      await pool.query(
        "DELETE FROM categories WHERE id::text = ANY($1::text[])",
        [createdCategoryIds]
      );
    }

    if (createdWarehouseIds.length > 0) {
      await pool.query(
        "DELETE FROM warehouses WHERE id::text = ANY($1::text[])",
        [createdWarehouseIds]
      );
    }

    if (createdCustomerIds.length > 0) {
      await pool.query(
        "DELETE FROM customers WHERE id::text = ANY($1::text[])",
        [createdCustomerIds]
      );
    }
  } finally {
    await pool.end();
  }
});

// --------------------------------------------------
// 1. ROLE-BASED ACCESS
// --------------------------------------------------

test("authenticated roles have the correct read permissions", async () => {
  const readableResources = [
    "/api/v1/categories",
    "/api/v1/products",
    "/api/v1/warehouses"
  ];

  for (const path of readableResources) {
    const salesResponse = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${salesToken}`);

    expectStatus(salesResponse, 200);

    const warehouseResponse = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${warehouseToken}`);

    expectStatus(warehouseResponse, 200);
  }

  const salesCustomers = await request(app)
    .get("/api/v1/customers")
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(salesCustomers, 200);

  const warehouseCustomers = await request(app)
    .get("/api/v1/customers")
    .set("Authorization", `Bearer ${warehouseToken}`);

  expectError(
    warehouseCustomers,
    403,
    "FORBIDDEN"
  );
});

test("only ADMIN can mutate categories, products, and warehouses", async () => {
  const protectedResources = [
    "/api/v1/categories",
    "/api/v1/products",
    "/api/v1/warehouses"
  ];

  for (const path of protectedResources) {
    const salesResponse = await request(app)
      .post(path)
      .set("Authorization", `Bearer ${salesToken}`)
      .send({});

    expectError(salesResponse, 403, "FORBIDDEN");

    const warehouseResponse = await request(app)
      .post(path)
      .set("Authorization", `Bearer ${warehouseToken}`)
      .send({});

    expectError(warehouseResponse, 403, "FORBIDDEN");
  }

  const warehouseCustomerCreate = await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${warehouseToken}`)
    .send({});

  expectError(
    warehouseCustomerCreate,
    403,
    "FORBIDDEN"
  );
});

// --------------------------------------------------
// 2. CATEGORY MANAGEMENT
// --------------------------------------------------

test("category can be created, read, updated, and deactivated", async () => {
  const originalName = `M3 Category ${runId}`;
  const updatedName = `M3 Category Updated ${runId}`;

  const createResponse = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: originalName,
      description: "Initial category description."
    });

  expectStatus(createResponse, 201);

  const created = getResource<CategoryResource>(
    createResponse,
    "category"
  );

  createdCategoryIds.push(created.id);

  assert.equal(created.name, originalName);
  assert.equal(created.isActive, true);

  const detailResponse = await request(app)
    .get(`/api/v1/categories/${created.id}`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(detailResponse, 200);

  const detail = getResource<CategoryResource>(
    detailResponse,
    "category"
  );

  assert.equal(detail.id, created.id);

  const updateResponse = await request(app)
    .patch(`/api/v1/categories/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: updatedName,
      description: "Updated category description."
    });

  expectStatus(updateResponse, 200);

  const updated = getResource<CategoryResource>(
    updateResponse,
    "category"
  );

  assert.equal(updated.name, updatedName);
  assert.equal(
    updated.description,
    "Updated category description."
  );

  const duplicateResponse = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: updatedName,
      description: "Duplicate category."
    });

  expectError(
    duplicateResponse,
    409,
    "CATEGORY_ALREADY_EXISTS"
  );

  const deactivateResponse = await request(app)
    .patch(`/api/v1/categories/${created.id}/deactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(deactivateResponse, 200);

  const deactivated = getResource<CategoryResource>(
    deactivateResponse,
    "category"
  );

  assert.equal(deactivated.isActive, false);

  const hiddenResponse = await request(app)
    .get(`/api/v1/categories/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(
    hiddenResponse,
    404,
    "CATEGORY_NOT_FOUND"
  );
});

test("category rejects invalid input", async () => {
  const response = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: ""
    });

  expectError(
    response,
    400,
    "VALIDATION_ERROR"
  );
});

// --------------------------------------------------
// 3. PRODUCT MANAGEMENT
// --------------------------------------------------

test("product can be created, read, updated, and deactivated", async () => {
  const category = await createCategoryFixture();

  const sku = `M3-${runId.slice(0, 12)}`;
  const updatedSku = `${sku}-UPDATED`;

  const createResponse = await request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      categoryId: category.id,
      sku: sku.toLowerCase(),
      name: "Module 3 Test Product",
      description: "Initial product description.",
      unitPrice: "1234"
    });

  expectStatus(createResponse, 201);

  const created = getResource<ProductResource>(
    createResponse,
    "product"
  );

  createdProductIds.push(created.id);

  assert.equal(created.sku, sku.toUpperCase());
  assert.equal(created.categoryId, category.id);
  assert.equal(created.unitPrice, "1234.00");
  assert.equal(created.isActive, true);

  const detailResponse = await request(app)
    .get(`/api/v1/products/${created.id}`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(detailResponse, 200);

  const detail = getResource<ProductResource>(
    detailResponse,
    "product"
  );

  assert.equal(detail.id, created.id);

  const duplicateResponse = await request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      categoryId: category.id,
      sku: sku.toLowerCase(),
      name: "Duplicate SKU Product",
      unitPrice: "100"
    });

  expectError(
    duplicateResponse,
    409,
    "PRODUCT_SKU_ALREADY_EXISTS"
  );

  const updateResponse = await request(app)
    .patch(`/api/v1/products/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      sku: updatedSku.toLowerCase(),
      name: "Module 3 Updated Product",
      unitPrice: "999.5"
    });

  expectStatus(updateResponse, 200);

  const updated = getResource<ProductResource>(
    updateResponse,
    "product"
  );

  assert.equal(updated.sku, updatedSku.toUpperCase());
  assert.equal(updated.name, "Module 3 Updated Product");
  assert.equal(updated.unitPrice, "999.50");

  const deactivateResponse = await request(app)
    .patch(`/api/v1/products/${created.id}/deactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(deactivateResponse, 200);

  const deactivated = getResource<ProductResource>(
    deactivateResponse,
    "product"
  );

  assert.equal(deactivated.isActive, false);

  const hiddenResponse = await request(app)
    .get(`/api/v1/products/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(
    hiddenResponse,
    404,
    "PRODUCT_NOT_FOUND"
  );
});

test("product rejects invalid prices and inactive categories", async () => {
  const category = await createCategoryFixture();

  const invalidPriceResponse = await request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      categoryId: category.id,
      sku: `M3-INVALID-${runId.slice(0, 8)}`,
      name: "Invalid Price Product",
      unitPrice: "-100"
    });

  expectError(
    invalidPriceResponse,
    400,
    "VALIDATION_ERROR"
  );

  const deactivateCategoryResponse = await request(app)
    .patch(`/api/v1/categories/${category.id}/deactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(deactivateCategoryResponse, 200);

  const inactiveCategoryProductResponse = await request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      categoryId: category.id,
      sku: `M3-INACTIVE-${runId.slice(0, 8)}`,
      name: "Inactive Category Product",
      unitPrice: "100"
    });

  expectError(
    inactiveCategoryProductResponse,
    404,
    "CATEGORY_NOT_FOUND"
  );
});

// --------------------------------------------------
// 4. WAREHOUSE MANAGEMENT
// --------------------------------------------------

test("warehouse supports create, update, deactivate, and reactivate", async () => {
  const code = `m3-${runId.slice(0, 8)}`;
  const updatedCode = `m3-updated-${runId.slice(0, 8)}`;

  const createResponse = await request(app)
    .post("/api/v1/warehouses")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code,
      name: "Module 3 Test Warehouse",
      address: "Test address."
    });

  expectStatus(createResponse, 201);

  const created = getResource<WarehouseResource>(
    createResponse,
    "warehouse"
  );

  createdWarehouseIds.push(created.id);

  assert.equal(created.code, code.toUpperCase());
  assert.equal(created.isActive, true);

  const duplicateResponse = await request(app)
    .post("/api/v1/warehouses")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: code.toUpperCase(),
      name: "Duplicate Warehouse"
    });

  expectError(
    duplicateResponse,
    409,
    "WAREHOUSE_CODE_ALREADY_EXISTS"
  );

  const updateResponse = await request(app)
    .patch(`/api/v1/warehouses/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: updatedCode,
      name: "Module 3 Updated Warehouse",
      address: "Updated test address."
    });

  expectStatus(updateResponse, 200);

  const updated = getResource<WarehouseResource>(
    updateResponse,
    "warehouse"
  );

  assert.equal(updated.code, updatedCode.toUpperCase());
  assert.equal(updated.name, "Module 3 Updated Warehouse");

  const duplicateExistingResponse = await request(app)
    .post("/api/v1/warehouses")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: "wh-jkt",
      name: "Duplicate Existing Warehouse"
    });

  expectError(
    duplicateExistingResponse,
    409,
    "WAREHOUSE_CODE_ALREADY_EXISTS"
  );

  const deactivateResponse = await request(app)
    .patch(`/api/v1/warehouses/${created.id}/deactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(deactivateResponse, 200);

  const deactivated = getResource<WarehouseResource>(
    deactivateResponse,
    "warehouse"
  );

  assert.equal(deactivated.isActive, false);

  const hiddenResponse = await request(app)
    .get(`/api/v1/warehouses/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(
    hiddenResponse,
    404,
    "WAREHOUSE_NOT_FOUND"
  );

  const reactivateResponse = await request(app)
    .patch(`/api/v1/warehouses/${created.id}/reactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(reactivateResponse, 200);

  const reactivated = getResource<WarehouseResource>(
    reactivateResponse,
    "warehouse"
  );

  assert.equal(reactivated.isActive, true);

  // Reactivation is idempotent.
  const secondReactivateResponse = await request(app)
    .patch(`/api/v1/warehouses/${created.id}/reactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(secondReactivateResponse, 200);

  const secondReactivated = getResource<WarehouseResource>(
    secondReactivateResponse,
    "warehouse"
  );

  assert.equal(secondReactivated.isActive, true);
});

test("warehouse rejects invalid input", async () => {
  const response = await request(app)
    .post("/api/v1/warehouses")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: "",
      name: ""
    });

  expectError(
    response,
    400,
    "VALIDATION_ERROR"
  );
});

// --------------------------------------------------
// 5. CUSTOMER MANAGEMENT
// --------------------------------------------------

test("SALES_STAFF can create, read, and update customers", async () => {
  const customerCode = `m3-${runId.slice(0, 8)}`;

  const createResponse = await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerCode,
      name: "Module 3 Test Customer",
      email: `module3-${runId}@example.test`,
      phone: "+62-31-555-9999",
      address: "Sidoarjo, East Java."
    });

  expectStatus(createResponse, 201);

  const created = getResource<CustomerResource>(
    createResponse,
    "customer"
  );

  createdCustomerIds.push(created.id);

  assert.equal(
    created.customerCode,
    customerCode.toUpperCase()
  );

  const detailResponse = await request(app)
    .get(`/api/v1/customers/${created.id}`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(detailResponse, 200);

  const detail = getResource<CustomerResource>(
    detailResponse,
    "customer"
  );

  assert.equal(detail.id, created.id);

  const updateResponse = await request(app)
    .patch(`/api/v1/customers/${created.id}`)
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      name: "Module 3 Updated Customer",
      address: "Updated Sidoarjo address."
    });

  expectStatus(updateResponse, 200);

  const updated = getResource<CustomerResource>(
    updateResponse,
    "customer"
  );

  assert.equal(updated.name, "Module 3 Updated Customer");
  assert.equal(
    updated.address,
    "Updated Sidoarjo address."
  );

  const duplicateResponse = await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      customerCode: customerCode.toUpperCase(),
      name: "Duplicate Customer"
    });

  expectError(
    duplicateResponse,
    409,
    "CUSTOMER_CODE_ALREADY_EXISTS"
  );
});

test("customer rejects invalid email and does not expose a DELETE route", async () => {
  const invalidEmailResponse = await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerCode: `M3-INVALID-${runId.slice(0, 8)}`,
      name: "Invalid Email Customer",
      email: "not-an-email"
    });

  expectError(
    invalidEmailResponse,
    400,
    "VALIDATION_ERROR"
  );

  const deleteResponse = await request(app)
    .delete("/api/v1/customers/1")
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(
    deleteResponse,
    404,
    "ROUTE_NOT_FOUND"
  );
});
