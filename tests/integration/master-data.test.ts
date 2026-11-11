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

function getResource<T>(response: { body: unknown }, key: string): T {
  const body = response.body as {
    data?: Record<string, unknown>;
  };

  assert.ok(body.data, "Response data is missing.");

  const resource = body.data[key];

  assert.ok(
    resource && typeof resource === "object",
    `Response resource "${key}" is missing.`,
  );

  return resource as T;
}

async function login(
  email: string,
  password: string | undefined,
  expectedRole: string,
): Promise<string> {
  assert.ok(password, `Password for ${expectedRole} is not configured.`);

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
      description: "Category fixture for automated tests.",
    });

  expectStatus(response, 201);

  const category = getResource<CategoryResource>(response, "category");

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
    "ADMIN",
  );

  salesToken = await login(
    "sales@stockflow.local",
    env.SEED_SALES_PASSWORD,
    "SALES_STAFF",
  );

  warehouseToken = await login(
    "warehouse@stockflow.local",
    env.SEED_WAREHOUSE_PASSWORD,
    "WAREHOUSE_STAFF",
  );
});

after(async () => {
  try {
    // Delete dependent product records first.
    if (createdProductIds.length > 0) {
      await pool.query(
        "DELETE FROM products WHERE id::text = ANY($1::text[])",
        [createdProductIds],
      );
    }

    if (createdCategoryIds.length > 0) {
      await pool.query(
        "DELETE FROM categories WHERE id::text = ANY($1::text[])",
        [createdCategoryIds],
      );
    }

    if (createdWarehouseIds.length > 0) {
      await pool.query(
        "DELETE FROM warehouses WHERE id::text = ANY($1::text[])",
        [createdWarehouseIds],
      );
    }

    if (createdCustomerIds.length > 0) {
      await pool.query(
        "DELETE FROM customers WHERE id::text = ANY($1::text[])",
        [createdCustomerIds],
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
    "/api/v1/warehouses",
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

  expectError(warehouseCustomers, 403, "FORBIDDEN");
});

test("only ADMIN can mutate categories, products, and warehouses", async () => {
  const protectedResources = [
    "/api/v1/categories",
    "/api/v1/products",
    "/api/v1/warehouses",
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

  expectError(warehouseCustomerCreate, 403, "FORBIDDEN");
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
      description: "Initial category description.",
    });

  expectStatus(createResponse, 201);

  const created = getResource<CategoryResource>(createResponse, "category");

  createdCategoryIds.push(created.id);

  assert.equal(created.name, originalName);
  assert.equal(created.isActive, true);

  const detailResponse = await request(app)
    .get(`/api/v1/categories/${created.id}`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(detailResponse, 200);

  const detail = getResource<CategoryResource>(detailResponse, "category");

  assert.equal(detail.id, created.id);

  const updateResponse = await request(app)
    .patch(`/api/v1/categories/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: updatedName,
      description: "Updated category description.",
    });

  expectStatus(updateResponse, 200);

  const updated = getResource<CategoryResource>(updateResponse, "category");

  assert.equal(updated.name, updatedName);
  assert.equal(updated.description, "Updated category description.");

  const duplicateResponse = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: updatedName,
      description: "Duplicate category.",
    });

  expectError(duplicateResponse, 409, "CATEGORY_ALREADY_EXISTS");

  const deactivateResponse = await request(app)
    .patch(`/api/v1/categories/${created.id}/deactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(deactivateResponse, 200);

  const deactivated = getResource<CategoryResource>(
    deactivateResponse,
    "category",
  );

  assert.equal(deactivated.isActive, false);

  const hiddenResponse = await request(app)
    .get(`/api/v1/categories/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(hiddenResponse, 404, "CATEGORY_NOT_FOUND");
});

test("category rejects invalid input", async () => {
  const response = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "",
    });

  expectError(response, 400, "VALIDATION_ERROR");
});

test("category list supports pagination and stable ordering", async () => {
  const firstResponse = await request(app)
    .get("/api/v1/categories")
    .query({
      limit: 2,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(firstResponse, 200);

  const firstPage = firstResponse.body.data;

  assert.ok(Array.isArray(firstPage.categories));
  assert.equal(firstPage.limit, 2);
  assert.equal(firstPage.offset, 0);
  assert.ok(firstPage.total >= 2);
  assert.equal(firstPage.categories.length, 2);

  const secondResponse = await request(app)
    .get("/api/v1/categories")
    .query({
      limit: 2,
      offset: 2,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(secondResponse, 200);

  const secondPage = secondResponse.body.data;

  assert.equal(secondPage.limit, 2);
  assert.equal(secondPage.offset, 2);
  assert.equal(secondPage.total, firstPage.total);

  const firstPageIds = firstPage.categories.map(
    (category: { id: string }) => category.id,
  );

  const secondPageIds = secondPage.categories.map(
    (category: { id: string }) => category.id,
  );

  for (const id of secondPageIds) {
    assert.equal(
      firstPageIds.includes(id),
      false,
      `Category ${id} appeared in both pages.`,
    );
  }

  // Repeating the same page must return the same order.
  const repeatedResponse = await request(app)
    .get("/api/v1/categories")
    .query({
      limit: 2,
      offset: 0,
    })
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(repeatedResponse, 200);

  const repeatedIds = repeatedResponse.body.data.categories.map(
    (category: { id: string }) => category.id,
  );

  assert.deepEqual(repeatedIds, firstPageIds);
});

test("category list applies default pagination and rejects invalid parameters", async () => {
  const defaultResponse = await request(app)
    .get("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(defaultResponse, 200);

  assert.equal(defaultResponse.body.data.limit, 50);
  assert.equal(defaultResponse.body.data.offset, 0);

  const invalidQueries = [
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { offset: -1 },
    { offset: 1.5 },
    { offset: 1000001 },
  ];

  for (const query of invalidQueries) {
    const response = await request(app)
      .get("/api/v1/categories")
      .query(query)
      .set("Authorization", `Bearer ${adminToken}`);

    expectError(response, 400, "VALIDATION_ERROR");
  }
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
      unitPrice: "1234",
    });

  expectStatus(createResponse, 201);

  const created = getResource<ProductResource>(createResponse, "product");

  createdProductIds.push(created.id);

  assert.equal(created.sku, sku.toUpperCase());
  assert.equal(created.categoryId, category.id);
  assert.equal(created.unitPrice, "1234.00");
  assert.equal(created.isActive, true);

  const detailResponse = await request(app)
    .get(`/api/v1/products/${created.id}`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(detailResponse, 200);

  const detail = getResource<ProductResource>(detailResponse, "product");

  assert.equal(detail.id, created.id);

  const duplicateResponse = await request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      categoryId: category.id,
      sku: sku.toLowerCase(),
      name: "Duplicate SKU Product",
      unitPrice: "100",
    });

  expectError(duplicateResponse, 409, "PRODUCT_SKU_ALREADY_EXISTS");

  const updateResponse = await request(app)
    .patch(`/api/v1/products/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      sku: updatedSku.toLowerCase(),
      name: "Module 3 Updated Product",
      unitPrice: "999.5",
    });

  expectStatus(updateResponse, 200);

  const updated = getResource<ProductResource>(updateResponse, "product");

  assert.equal(updated.sku, updatedSku.toUpperCase());
  assert.equal(updated.name, "Module 3 Updated Product");
  assert.equal(updated.unitPrice, "999.50");

  const deactivateResponse = await request(app)
    .patch(`/api/v1/products/${created.id}/deactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(deactivateResponse, 200);

  const deactivated = getResource<ProductResource>(
    deactivateResponse,
    "product",
  );

  assert.equal(deactivated.isActive, false);

  const hiddenResponse = await request(app)
    .get(`/api/v1/products/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(hiddenResponse, 404, "PRODUCT_NOT_FOUND");
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
      unitPrice: "-100",
    });

  expectError(invalidPriceResponse, 400, "VALIDATION_ERROR");

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
      unitPrice: "100",
    });

  expectError(inactiveCategoryProductResponse, 404, "CATEGORY_NOT_FOUND");
});

test("product list supports pagination and stable ordering", async () => {
  const firstPageResponse = await request(app)
    .get("/api/v1/products?limit=2&offset=0")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(firstPageResponse, 200);

  const firstPageBody = firstPageResponse.body as {
    data?: {
      products?: ProductResource[];
      total?: number;
      limit?: number;
      offset?: number;
    };
  };

  assert.ok(firstPageBody.data);
  assert.ok(firstPageBody.data.products);

  const firstProducts = firstPageBody.data.products;

  assert.equal(firstPageBody.data.limit, 2);
  assert.equal(firstPageBody.data.offset, 0);
  assert.ok((firstPageBody.data.total ?? 0) >= 2);
  assert.equal(firstProducts.length, 2);

  // Request the first page again to verify stable ordering.
  const repeatedResponse = await request(app)
    .get("/api/v1/products?limit=2&offset=0")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(repeatedResponse, 200);

  const repeatedBody = repeatedResponse.body as {
    data?: {
      products?: ProductResource[];
    };
  };

  assert.ok(repeatedBody.data);
  assert.ok(repeatedBody.data.products);

  assert.deepEqual(
    repeatedBody.data.products.map((product) => product.id),
    firstProducts.map((product) => product.id),
  );

  // Retrieve the second page.
  const secondPageResponse = await request(app)
    .get("/api/v1/products?limit=2&offset=2")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(secondPageResponse, 200);

  const secondPageBody = secondPageResponse.body as {
    data?: {
      products?: ProductResource[];
      total?: number;
      limit?: number;
      offset?: number;
    };
  };

  assert.ok(secondPageBody.data);
  assert.ok(secondPageBody.data.products);

  const secondProducts = secondPageBody.data.products;

  assert.equal(secondPageBody.data.limit, 2);
  assert.equal(secondPageBody.data.offset, 2);
  assert.equal(secondPageBody.data.total, firstPageBody.data.total);
  assert.equal(secondProducts.length, 2);

  const firstPageIds = new Set(firstProducts.map((product) => product.id));

  assert.ok(
    secondProducts.every((product) => !firstPageIds.has(product.id)),
    "The two pages should not contain overlapping products.",
  );
});

test("product list applies default pagination and rejects invalid parameters", async () => {
  const defaultResponse = await request(app)
    .get("/api/v1/products")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(defaultResponse, 200);

  const defaultBody = defaultResponse.body as {
    data?: {
      products?: ProductResource[];
      total?: number;
      limit?: number;
      offset?: number;
    };
  };

  assert.ok(defaultBody.data);
  assert.ok(defaultBody.data.products);

  assert.equal(defaultBody.data.limit, 50);
  assert.equal(defaultBody.data.offset, 0);
  assert.ok((defaultBody.data.total ?? 0) >= defaultBody.data.products.length);
  assert.ok(defaultBody.data.products.length <= 50);

  const invalidQueries = [
    "limit=0",
    "limit=101",
    "limit=1.5",
    "offset=-1",
    "offset=1.5",
    "offset=1000001",
  ];

  for (const query of invalidQueries) {
    const response = await request(app)
      .get(`/api/v1/products?${query}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expectError(response, 400, "VALIDATION_ERROR");
  }
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
      address: "Test address.",
    });

  expectStatus(createResponse, 201);

  const created = getResource<WarehouseResource>(createResponse, "warehouse");

  createdWarehouseIds.push(created.id);

  assert.equal(created.code, code.toUpperCase());
  assert.equal(created.isActive, true);

  const duplicateResponse = await request(app)
    .post("/api/v1/warehouses")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: code.toUpperCase(),
      name: "Duplicate Warehouse",
    });

  expectError(duplicateResponse, 409, "WAREHOUSE_CODE_ALREADY_EXISTS");

  const updateResponse = await request(app)
    .patch(`/api/v1/warehouses/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: updatedCode,
      name: "Module 3 Updated Warehouse",
      address: "Updated test address.",
    });

  expectStatus(updateResponse, 200);

  const updated = getResource<WarehouseResource>(updateResponse, "warehouse");

  assert.equal(updated.code, updatedCode.toUpperCase());
  assert.equal(updated.name, "Module 3 Updated Warehouse");

  const duplicateExistingResponse = await request(app)
    .post("/api/v1/warehouses")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: "wh-jkt",
      name: "Duplicate Existing Warehouse",
    });

  expectError(duplicateExistingResponse, 409, "WAREHOUSE_CODE_ALREADY_EXISTS");

  const deactivateResponse = await request(app)
    .patch(`/api/v1/warehouses/${created.id}/deactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(deactivateResponse, 200);

  const deactivated = getResource<WarehouseResource>(
    deactivateResponse,
    "warehouse",
  );

  assert.equal(deactivated.isActive, false);

  const hiddenResponse = await request(app)
    .get(`/api/v1/warehouses/${created.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(hiddenResponse, 404, "WAREHOUSE_NOT_FOUND");

  const reactivateResponse = await request(app)
    .patch(`/api/v1/warehouses/${created.id}/reactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(reactivateResponse, 200);

  const reactivated = getResource<WarehouseResource>(
    reactivateResponse,
    "warehouse",
  );

  assert.equal(reactivated.isActive, true);

  // Reactivation is idempotent.
  const secondReactivateResponse = await request(app)
    .patch(`/api/v1/warehouses/${created.id}/reactivate`)
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(secondReactivateResponse, 200);

  const secondReactivated = getResource<WarehouseResource>(
    secondReactivateResponse,
    "warehouse",
  );

  assert.equal(secondReactivated.isActive, true);
});

test("warehouse rejects invalid input", async () => {
  const response = await request(app)
    .post("/api/v1/warehouses")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: "",
      name: "",
    });

  expectError(response, 400, "VALIDATION_ERROR");
});

test("warehouse list supports pagination and stable ordering", async () => {
  const firstPageResponse = await request(app)
    .get("/api/v1/warehouses?limit=1&offset=0")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(firstPageResponse, 200);

  const firstPageBody = firstPageResponse.body as {
    data?: {
      warehouses?: WarehouseResource[];
      total?: number;
      limit?: number;
      offset?: number;
    };
  };

  assert.ok(firstPageBody.data);
  assert.ok(firstPageBody.data.warehouses);

  const firstWarehouses = firstPageBody.data.warehouses;

  assert.equal(firstPageBody.data.limit, 1);
  assert.equal(firstPageBody.data.offset, 0);
  assert.ok((firstPageBody.data.total ?? 0) >= 2);
  assert.equal(firstWarehouses.length, 1);

  // Request the first page again to verify stable ordering.
  const repeatedResponse = await request(app)
    .get("/api/v1/warehouses?limit=1&offset=0")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(repeatedResponse, 200);

  const repeatedBody = repeatedResponse.body as {
    data?: {
      warehouses?: WarehouseResource[];
    };
  };

  assert.ok(repeatedBody.data);
  assert.ok(repeatedBody.data.warehouses);

  assert.deepEqual(
    repeatedBody.data.warehouses.map((warehouse) => warehouse.id),
    firstWarehouses.map((warehouse) => warehouse.id),
  );

  // Retrieve the second page.
  const secondPageResponse = await request(app)
    .get("/api/v1/warehouses?limit=1&offset=1")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(secondPageResponse, 200);

  const secondPageBody = secondPageResponse.body as {
    data?: {
      warehouses?: WarehouseResource[];
      total?: number;
      limit?: number;
      offset?: number;
    };
  };

  assert.ok(secondPageBody.data);
  assert.ok(secondPageBody.data.warehouses);

  const secondWarehouses = secondPageBody.data.warehouses;

  assert.equal(secondPageBody.data.limit, 1);
  assert.equal(secondPageBody.data.offset, 1);
  assert.equal(secondPageBody.data.total, firstPageBody.data.total);
  assert.equal(secondWarehouses.length, 1);

  const firstPageIds = new Set(
    firstWarehouses.map((warehouse) => warehouse.id),
  );

  assert.ok(
    secondWarehouses.every((warehouse) => !firstPageIds.has(warehouse.id)),
    "The two pages should not contain overlapping warehouses.",
  );
});

test("warehouse list applies default pagination and rejects invalid parameters", async () => {
  const defaultResponse = await request(app)
    .get("/api/v1/warehouses")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(defaultResponse, 200);

  const defaultBody = defaultResponse.body as {
    data?: {
      warehouses?: WarehouseResource[];
      total?: number;
      limit?: number;
      offset?: number;
    };
  };

  assert.ok(defaultBody.data);
  assert.ok(defaultBody.data.warehouses);

  assert.equal(defaultBody.data.limit, 50);
  assert.equal(defaultBody.data.offset, 0);
  assert.ok(
    (defaultBody.data.total ?? 0) >= defaultBody.data.warehouses.length,
  );
  assert.ok(defaultBody.data.warehouses.length <= 50);

  const invalidQueries = [
    "limit=0",
    "limit=101",
    "limit=1.5",
    "offset=-1",
    "offset=1.5",
    "offset=1000001",
  ];

  for (const query of invalidQueries) {
    const response = await request(app)
      .get(`/api/v1/warehouses?${query}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expectError(response, 400, "VALIDATION_ERROR");
  }
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
      address: "Sidoarjo, East Java.",
    });

  expectStatus(createResponse, 201);

  const created = getResource<CustomerResource>(createResponse, "customer");

  createdCustomerIds.push(created.id);

  assert.equal(created.customerCode, customerCode.toUpperCase());

  const detailResponse = await request(app)
    .get(`/api/v1/customers/${created.id}`)
    .set("Authorization", `Bearer ${salesToken}`);

  expectStatus(detailResponse, 200);

  const detail = getResource<CustomerResource>(detailResponse, "customer");

  assert.equal(detail.id, created.id);

  const updateResponse = await request(app)
    .patch(`/api/v1/customers/${created.id}`)
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      name: "Module 3 Updated Customer",
      address: "Updated Sidoarjo address.",
    });

  expectStatus(updateResponse, 200);

  const updated = getResource<CustomerResource>(updateResponse, "customer");

  assert.equal(updated.name, "Module 3 Updated Customer");
  assert.equal(updated.address, "Updated Sidoarjo address.");

  const duplicateResponse = await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      customerCode: customerCode.toUpperCase(),
      name: "Duplicate Customer",
    });

  expectError(duplicateResponse, 409, "CUSTOMER_CODE_ALREADY_EXISTS");
});

test("customer rejects invalid email and does not expose a DELETE route", async () => {
  const invalidEmailResponse = await request(app)
    .post("/api/v1/customers")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customerCode: `M3-INVALID-${runId.slice(0, 8)}`,
      name: "Invalid Email Customer",
      email: "not-an-email",
    });

  expectError(invalidEmailResponse, 400, "VALIDATION_ERROR");

  const deleteResponse = await request(app)
    .delete("/api/v1/customers/1")
    .set("Authorization", `Bearer ${adminToken}`);

  expectError(deleteResponse, 404, "ROUTE_NOT_FOUND");
});

test("customer list supports pagination and stable ordering", async () => {
  const firstPageResponse = await request(app)
    .get("/api/v1/customers?limit=2&offset=0")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(firstPageResponse, 200);

  const firstPageBody = firstPageResponse.body as {
    data?: {
      customers?: CustomerResource[];
      total?: number;
      limit?: number;
      offset?: number;
    };
  };

  assert.ok(firstPageBody.data);
  assert.ok(firstPageBody.data.customers);

  const firstCustomers = firstPageBody.data.customers;

  assert.equal(firstPageBody.data.limit, 2);
  assert.equal(firstPageBody.data.offset, 0);
  assert.ok((firstPageBody.data.total ?? 0) >= 2);
  assert.equal(firstCustomers.length, 2);

  // Request the first page again to verify stable ordering.
  const repeatedResponse = await request(app)
    .get("/api/v1/customers?limit=2&offset=0")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(repeatedResponse, 200);

  const repeatedBody = repeatedResponse.body as {
    data?: {
      customers?: CustomerResource[];
    };
  };

  assert.ok(repeatedBody.data);
  assert.ok(repeatedBody.data.customers);

  assert.deepEqual(
    repeatedBody.data.customers.map((customer) => customer.id),
    firstCustomers.map((customer) => customer.id),
  );

  // Retrieve the second page.
  const secondPageResponse = await request(app)
    .get("/api/v1/customers?limit=2&offset=2")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(secondPageResponse, 200);

  const secondPageBody = secondPageResponse.body as {
    data?: {
      customers?: CustomerResource[];
      total?: number;
      limit?: number;
      offset?: number;
    };
  };

  assert.ok(secondPageBody.data);
  assert.ok(secondPageBody.data.customers);

  const secondCustomers = secondPageBody.data.customers;

  assert.equal(secondPageBody.data.limit, 2);
  assert.equal(secondPageBody.data.offset, 2);
  assert.equal(secondPageBody.data.total, firstPageBody.data.total);
  assert.equal(secondCustomers.length, 2);

  const firstPageIds = new Set(firstCustomers.map((customer) => customer.id));

  assert.ok(
    secondCustomers.every((customer) => !firstPageIds.has(customer.id)),
    "The two pages should not contain overlapping customers.",
  );
});

test("customer list applies default pagination and rejects invalid parameters", async () => {
  const defaultResponse = await request(app)
    .get("/api/v1/customers")
    .set("Authorization", `Bearer ${adminToken}`);

  expectStatus(defaultResponse, 200);

  const defaultBody = defaultResponse.body as {
    data?: {
      customers?: CustomerResource[];
      total?: number;
      limit?: number;
      offset?: number;
    };
  };

  assert.ok(defaultBody.data);
  assert.ok(defaultBody.data.customers);

  assert.equal(defaultBody.data.limit, 50);
  assert.equal(defaultBody.data.offset, 0);
  assert.ok((defaultBody.data.total ?? 0) >= defaultBody.data.customers.length);
  assert.ok(defaultBody.data.customers.length <= 50);

  const invalidQueries = [
    "limit=0",
    "limit=101",
    "limit=1.5",
    "offset=-1",
    "offset=1.5",
    "offset=1000001",
  ];

  for (const query of invalidQueries) {
    const response = await request(app)
      .get(`/api/v1/customers?${query}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expectError(response, 400, "VALIDATION_ERROR");
  }
});
