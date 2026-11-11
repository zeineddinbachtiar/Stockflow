import { pool } from "../config/database";
import type { PoolClient } from "pg";

import type {
  StockMovementRecord,
  StockMovementInsertInput,
  StockMovementQuery,
} from "../types/stock-movement.types";

const STOCK_MOVEMENT_SELECT = `
  SELECT
    sm.id,
    sm.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    sm.product_id,
    p.sku AS product_sku,
    p.name AS product_name,
    sm.performed_by,
    u.full_name AS performed_by_name,
    sm.order_id,
    sm.movement_type,
    sm.quantity_delta,
    sm.reason,
    sm.created_at
  FROM stock_movements sm
  JOIN warehouses w ON w.id = sm.warehouse_id
  JOIN products p ON p.id = sm.product_id
  JOIN users u ON u.id = sm.performed_by
`;

/**
 * Insert a stock movement.
 * Must be called using an existing database transaction.
 */
export async function insertStockMovement(
  client: PoolClient,
  input: StockMovementInsertInput,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO stock_movements (
       warehouse_id,
       product_id,
       performed_by,
       order_id,
       movement_type,
       quantity_delta,
       reason
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.warehouseId,
      input.productId,
      input.performedBy,
      input.orderId,
      input.movementType,
      input.quantityDelta,
      input.reason ?? null,
    ],
  );

  return result.rows[0].id;
}

/**
 * Retrieve stock movement within an existing transaction.
 */
export async function findStockMovementByIdWithClient(
  client: PoolClient,
  id: string,
): Promise<StockMovementRecord | null> {
  const result = await client.query<StockMovementRecord>(
    `${STOCK_MOVEMENT_SELECT}
     WHERE sm.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

/**
 * Retrieve a stock movement by ID.
 */
export async function findStockMovementById(
  id: string,
): Promise<StockMovementRecord | null> {
  const result = await pool.query<StockMovementRecord>(
    `${STOCK_MOVEMENT_SELECT}
     WHERE sm.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

/**
 * Retrieve stock movement history with filters and pagination.
 */
export async function findAllStockMovements(
  query: StockMovementQuery,
): Promise<{ items: StockMovementRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (query.warehouseId !== undefined) {
    values.push(query.warehouseId);
    conditions.push(`sm.warehouse_id = $${values.length}`);
  }

  if (query.productId !== undefined) {
    values.push(query.productId);
    conditions.push(`sm.product_id = $${values.length}`);
  }

  if (query.movementType !== undefined) {
    values.push(query.movementType);
    conditions.push(`sm.movement_type = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM stock_movements sm
     ${whereClause}`,
    values,
  );

  const pageValues = [...values];

  pageValues.push(query.limit);
  const limitPosition = pageValues.length;

  pageValues.push(query.offset);
  const offsetPosition = pageValues.length;

  const result = await pool.query<StockMovementRecord>(
    `${STOCK_MOVEMENT_SELECT}
     ${whereClause}
     ORDER BY sm.created_at DESC, sm.id DESC
     LIMIT $${limitPosition}
     OFFSET $${offsetPosition}`,
    pageValues,
  );

  return {
    items: result.rows,
    total: Number(countResult.rows[0].total),
  };
}
