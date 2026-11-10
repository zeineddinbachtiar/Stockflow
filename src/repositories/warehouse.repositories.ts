
import { pool } from "../config/database";

import type {
  WarehouseRecord,
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from "../types/warehouse.types";

/**
 * Retrieve all active warehouses.
 */
export async function findAllActiveWarehouses(): Promise<WarehouseRecord[]> {
  const result = await pool.query<WarehouseRecord>(
    `SELECT
       id,
       code,
       name,
       address,
       is_active,
       created_at,
       updated_at
     FROM warehouses
     WHERE is_active = TRUE
     ORDER BY name ASC`
  );

  return result.rows;
}

/**
 * Retrieve a warehouse by ID.
 * Includes inactive warehouses.
 */
export async function findWarehouseById(
  id: string
): Promise<WarehouseRecord | null> {
  const result = await pool.query<WarehouseRecord>(
    `SELECT
       id,
       code,
       name,
       address,
       is_active,
       created_at,
       updated_at
     FROM warehouses
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Retrieve a warehouse by code.
 * Includes inactive warehouses because code is unique globally.
 */
export async function findWarehouseByCode(
  code: string
): Promise<WarehouseRecord | null> {
  const result = await pool.query<WarehouseRecord>(
    `SELECT
       id,
       code,
       name,
       address,
       is_active,
       created_at,
       updated_at
     FROM warehouses
     WHERE code = $1`,
    [code]
  );

  return result.rows[0] ?? null;
}

/**
 * Create a new warehouse.
 */
export async function createWarehouse(
  input: CreateWarehouseInput
): Promise<WarehouseRecord> {
  const result = await pool.query<WarehouseRecord>(
    `INSERT INTO warehouses (
       code,
       name,
       address
     )
     VALUES ($1, $2, $3)
     RETURNING
       id,
       code,
       name,
       address,
       is_active,
       created_at,
       updated_at`,
    [
      input.code,
      input.name,
      input.address ?? null,
    ]
  );

  return result.rows[0];
}

/**
 * Update an existing warehouse.
 * Returns null if the warehouse does not exist.
 */
export async function updateWarehouse(
  id: string,
  input: UpdateWarehouseInput
): Promise<WarehouseRecord | null> {
  const values: Array<string | null> = [];
  const assignments: string[] = [];

  if (input.code !== undefined) {
    values.push(input.code);
    assignments.push(`code = $${values.length}`);
  }

  if (input.name !== undefined) {
    values.push(input.name);
    assignments.push(`name = $${values.length}`);
  }

  if (input.address !== undefined) {
    values.push(input.address);
    assignments.push(`address = $${values.length}`);
  }

  if (assignments.length === 0) {
    throw new Error("No warehouse fields provided for update.");
  }

  values.push(id);

  const result = await pool.query<WarehouseRecord>(
    `UPDATE warehouses
     SET ${assignments.join(", ")}
     WHERE id = $${values.length}
     RETURNING
       id,
       code,
       name,
       address,
       is_active,
       created_at,
       updated_at`,
    values
  );

  return result.rows[0] ?? null;
}

/**
 * Deactivate a warehouse without physically deleting it.
 */
export async function deactivateWarehouse(
  id: string
): Promise<WarehouseRecord | null> {
  const result = await pool.query<WarehouseRecord>(
    `UPDATE warehouses
     SET is_active = FALSE
     WHERE id = $1
     RETURNING
       id,
       code,
       name,
       address,
       is_active,
       created_at,
       updated_at`,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Reactivate a previously deactivated warehouse.
 */
export async function reactivateWarehouse(
  id: string
): Promise<WarehouseRecord | null> {
  const result = await pool.query<WarehouseRecord>(
    `UPDATE warehouses
     SET is_active = TRUE
     WHERE id = $1
     RETURNING
       id,
       code,
       name,
       address,
       is_active,
       created_at,
       updated_at`,
    [id]
  );

  return result.rows[0] ?? null;
}
