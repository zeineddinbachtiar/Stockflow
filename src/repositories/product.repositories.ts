import { pool } from "../config/database";

import type {
  ProductRecord,
  CreateProductInput,
  UpdateProductInput,
  ProductListQuery,
} from "../types/product.types";
import type { PaginatedRecords } from "../types/common.types";

/**
 * Retrieve all active products.
 */
/**
 * Retrieve active products with pagination.
 */
/**
 * Retrieve active products with pagination and optional search.
 */
export async function findAllActiveProducts(
  query: ProductListQuery,
): Promise<PaginatedRecords<ProductRecord>> {
  const search = query.search ?? null;

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM products
     WHERE is_active = TRUE
       AND (
         $1::text IS NULL
         OR name ILIKE '%' || $1 || '%'
         OR sku ILIKE '%' || $1 || '%'
       )`,
    [search],
  );

  const result = await pool.query<ProductRecord>(
    `SELECT
       id,
       category_id,
       sku,
       name,
       description,
       unit_price,
       is_active,
       created_at,
       updated_at
     FROM products
     WHERE is_active = TRUE
       AND (
         $1::text IS NULL
         OR name ILIKE '%' || $1 || '%'
         OR sku ILIKE '%' || $1 || '%'
       )
     ORDER BY name ASC, id ASC
     LIMIT $2 OFFSET $3`,
    [search, query.limit, query.offset],
  );

  return {
    items: result.rows,
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

/**
 * Retrieve a product by ID.
 * Returns null if the product does not exist.
 */
export async function findProductById(
  id: string,
): Promise<ProductRecord | null> {
  const result = await pool.query<ProductRecord>(
    `SELECT
       id,
       category_id,
       sku,
       name,
       description,
       unit_price,
       is_active,
       created_at,
       updated_at
     FROM products
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

/**
 * Retrieve a product by SKU.
 * Includes inactive products because SKU is unique
 * across the entire products table.
 */
export async function findProductBySku(
  sku: string,
): Promise<ProductRecord | null> {
  const result = await pool.query<ProductRecord>(
    `SELECT
       id,
       category_id,
       sku,
       name,
       description,
       unit_price,
       is_active,
       created_at,
       updated_at
     FROM products
     WHERE sku = $1`,
    [sku],
  );

  return result.rows[0] ?? null;
}

/**
 * Create a new product.
 */
export async function createProduct(
  input: CreateProductInput,
): Promise<ProductRecord> {
  const result = await pool.query<ProductRecord>(
    `INSERT INTO products (
       category_id,
       sku,
       name,
       description,
       unit_price
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       id,
       category_id,
       sku,
       name,
       description,
       unit_price,
       is_active,
       created_at,
       updated_at`,
    [
      input.categoryId,
      input.sku,
      input.name,
      input.description ?? null,
      input.unitPrice,
    ],
  );

  return result.rows[0];
}

/**
 * Update an existing product.
 * Returns null if the product does not exist.
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<ProductRecord | null> {
  const values: Array<string | null> = [];
  const assignments: string[] = [];

  if (input.categoryId !== undefined) {
    values.push(input.categoryId);
    assignments.push(`category_id = $${values.length}`);
  }

  if (input.sku !== undefined) {
    values.push(input.sku);
    assignments.push(`sku = $${values.length}`);
  }

  if (input.name !== undefined) {
    values.push(input.name);
    assignments.push(`name = $${values.length}`);
  }

  if (input.description !== undefined) {
    values.push(input.description);
    assignments.push(`description = $${values.length}`);
  }

  if (input.unitPrice !== undefined) {
    values.push(input.unitPrice);
    assignments.push(`unit_price = $${values.length}`);
  }

  if (assignments.length === 0) {
    throw new Error("No product fields provided for update.");
  }

  values.push(id);

  const result = await pool.query<ProductRecord>(
    `UPDATE products
     SET ${assignments.join(", ")}
     WHERE id = $${values.length}
     RETURNING
       id,
       category_id,
       sku,
       name,
       description,
       unit_price,
       is_active,
       created_at,
       updated_at`,
    values,
  );

  return result.rows[0] ?? null;
}

/**
 * Deactivate a product without physically deleting it.
 */
export async function deactivateProduct(
  id: string,
): Promise<ProductRecord | null> {
  const result = await pool.query<ProductRecord>(
    `UPDATE products
     SET is_active = FALSE
     WHERE id = $1
     RETURNING
       id,
       category_id,
       sku,
       name,
       description,
       unit_price,
       is_active,
       created_at,
       updated_at`,
    [id],
  );

  return result.rows[0] ?? null;
}
