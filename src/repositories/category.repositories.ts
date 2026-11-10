
import { pool } from "../config/database";
import type {
  CategoryRecord,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../types/category.types";

/**
 * Retrieve all active categories.
 */
export async function findAllActiveCategories(): Promise<CategoryRecord[]> {
  const result = await pool.query<CategoryRecord>(
    `SELECT
       id,
       name,
       description,
       is_active,
       created_at,
       updated_at
     FROM categories
     WHERE is_active = TRUE
     ORDER BY name ASC`
  );

  return result.rows;
}

/**
 * Retrieve a category by ID.
 * Returns null if the category does not exist.
 */
export async function findCategoryById(
  id: string
): Promise<CategoryRecord | null> {
  const result = await pool.query<CategoryRecord>(
    `SELECT
       id,
       name,
       description,
       is_active,
       created_at,
       updated_at
     FROM categories
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Retrieve a category by its exact name.
 * Includes inactive categories because category names are unique
 * across the entire table.
 */
export async function findCategoryByName(
  name: string
): Promise<CategoryRecord | null> {
  const result = await pool.query<CategoryRecord>(
    `SELECT
       id,
       name,
       description,
       is_active,
       created_at,
       updated_at
     FROM categories
     WHERE name = $1`,
    [name]
  );

  return result.rows[0] ?? null;
}

/**
 * Create a new category.
 */
export async function createCategory(
  input: CreateCategoryInput
): Promise<CategoryRecord> {
  const result = await pool.query<CategoryRecord>(
    `INSERT INTO categories (name, description)
     VALUES ($1, $2)
     RETURNING
       id,
       name,
       description,
       is_active,
       created_at,
       updated_at`,
    [input.name, input.description ?? null]
  );

  return result.rows[0];
}

/**
 * Update an existing category.
 * Returns null if the category does not exist.
 */
export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<CategoryRecord | null> {
  const values: Array<string | null> = [];
  const assignments: string[] = [];

  if (input.name !== undefined) {
    values.push(input.name);
    assignments.push(`name = $${values.length}`);
  }

  if (input.description !== undefined) {
    values.push(input.description);
    assignments.push(`description = $${values.length}`);
  }

  if (assignments.length === 0) {
    throw new Error("No category fields provided for update.");
  }

  values.push(id);

  const result = await pool.query<CategoryRecord>(
    `UPDATE categories
     SET ${assignments.join(", ")}
     WHERE id = $${values.length}
     RETURNING
       id,
       name,
       description,
       is_active,
       created_at,
       updated_at`,
    values
  );

  return result.rows[0] ?? null;
}

/**
 * Deactivate a category without physically deleting it.
 */
export async function deactivateCategory(
  id: string
): Promise<CategoryRecord | null> {
  const result = await pool.query<CategoryRecord>(
    `UPDATE categories
     SET is_active = FALSE
     WHERE id = $1
     RETURNING
       id,
       name,
       description,
       is_active,
       created_at,
       updated_at`,
    [id]
  );

  return result.rows[0] ?? null;
}

