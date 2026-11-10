
import { pool } from "../config/database";
import type { PoolClient } from "pg";

import type {
  InventoryBalanceRecord,
  InventoryRecord,
  InventoryQuery,
} from "../types/inventory.types";

const INVENTORY_SELECT = `
  SELECT
    i.id,
    i.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    w.is_active AS warehouse_is_active,
    i.product_id,
    p.sku AS product_sku,
    p.name AS product_name,
    p.is_active AS product_is_active,
    i.quantity_on_hand,
    i.reorder_level,
    i.updated_at
  FROM inventory i
  JOIN warehouses w ON w.id = i.warehouse_id
  JOIN products p ON p.id = i.product_id
`;

/**
 * Retrieve inventory records with optional filters and pagination.
 */
export async function findAllInventory(
  query: InventoryQuery
): Promise<{ items: InventoryRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (query.warehouseId !== undefined) {
    values.push(query.warehouseId);
    conditions.push(`i.warehouse_id = $${values.length}`);
  }

  if (query.productId !== undefined) {
    values.push(query.productId);
    conditions.push(`i.product_id = $${values.length}`);
  }

  if (query.lowStock !== undefined) {
    conditions.push(
      query.lowStock
        ? "i.quantity_on_hand <= i.reorder_level"
        : "i.quantity_on_hand > i.reorder_level"
    );
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM inventory i
     ${whereClause}`,
    values
  );

  const pageValues = [...values];

  pageValues.push(query.limit);
  const limitPosition = pageValues.length;

  pageValues.push(query.offset);
  const offsetPosition = pageValues.length;

  const result = await pool.query<InventoryRecord>(
    `${INVENTORY_SELECT}
     ${whereClause}
     ORDER BY w.code ASC, p.name ASC
     LIMIT $${limitPosition}
     OFFSET $${offsetPosition}`,
    pageValues
  );

  return {
    items: result.rows,
    total: Number(countResult.rows[0].total),
  };
}

/**
 * Retrieve inventory detail by ID.
 */
export async function findInventoryById(
  id: string
): Promise<InventoryRecord | null> {
  const result = await pool.query<InventoryRecord>(
    `${INVENTORY_SELECT}
     WHERE i.id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Retrieve inventory detail within an existing transaction.
 */
export async function findInventoryByIdWithClient(
  client: PoolClient,
  id: string
): Promise<InventoryRecord | null> {
  const result = await client.query<InventoryRecord>(
    `${INVENTORY_SELECT}
     WHERE i.id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Lock an active warehouse using a shared row lock.
 *
 * This prevents concurrent deactivation while a stock operation
 * is in progress.
 */
export async function lockActiveWarehouse(
  client: PoolClient,
  warehouseId: string
): Promise<boolean> {
  const result = await client.query<{ id: string }>(
    `SELECT id
     FROM warehouses
     WHERE id = $1
       AND is_active = TRUE
     FOR SHARE`,
    [warehouseId]
  );

  return result.rows.length > 0;
}

/**
 * Lock an active product using a shared row lock.
 *
 * This prevents concurrent deactivation while a stock operation
 * is in progress.
 */
export async function lockActiveProduct(
  client: PoolClient,
  productId: string
): Promise<boolean> {
  const result = await client.query<{ id: string }>(
    `SELECT id
     FROM products
     WHERE id = $1
       AND is_active = TRUE
     FOR SHARE`,
    [productId]
  );

  return result.rows.length > 0;
}

/**
 * Create an inventory row if it does not exist.
 * Existing inventory balances and reorder levels are preserved.
 */
export async function ensureInventoryRow(
  client: PoolClient,
  warehouseId: string,
  productId: string
): Promise<void> {
  await client.query(
    `INSERT INTO inventory (
       warehouse_id,
       product_id,
       quantity_on_hand,
       reorder_level
     )
     VALUES ($1, $2, 0, 0)
     ON CONFLICT (warehouse_id, product_id)
     DO NOTHING`,
    [warehouseId, productId]
  );
}

/**
 * Retrieve and exclusively lock an inventory balance.
 */
export async function lockInventoryBalance(
  client: PoolClient,
  warehouseId: string,
  productId: string
): Promise<InventoryBalanceRecord | null> {
  const result = await client.query<InventoryBalanceRecord>(
    `SELECT
       id,
       warehouse_id,
       product_id,
       quantity_on_hand,
       reorder_level,
       updated_at
     FROM inventory
     WHERE warehouse_id = $1
       AND product_id = $2
     FOR UPDATE`,
    [warehouseId, productId]
  );

  return result.rows[0] ?? null;
}

/**
 * Update the stock quantity.
 */
export async function updateInventoryQuantity(
  client: PoolClient,
  id: string,
  quantity: number
): Promise<InventoryBalanceRecord | null> {
  const result = await client.query<InventoryBalanceRecord>(
    `UPDATE inventory
     SET quantity_on_hand = $1
     WHERE id = $2
     RETURNING
       id,
       warehouse_id,
       product_id,
       quantity_on_hand,
       reorder_level,
       updated_at`,
    [quantity, id]
  );

  return result.rows[0] ?? null;
}

/**
 * Update inventory reorder level.
 */
export async function updateInventoryReorderLevel(
  id: string,
  reorderLevel: number
): Promise<InventoryBalanceRecord | null> {
  const result = await pool.query<InventoryBalanceRecord>(
    `UPDATE inventory
     SET reorder_level = $1
     WHERE id = $2
     RETURNING
       id,
       warehouse_id,
       product_id,
       quantity_on_hand,
       reorder_level,
       updated_at`,
    [reorderLevel, id]
  );

  return result.rows[0] ?? null;
}
