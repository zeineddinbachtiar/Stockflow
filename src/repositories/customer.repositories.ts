import { pool } from "../config/database";

import type {
  CustomerRecord,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../types/customer.types";

/**
 * Retrieve all customers.
 */
export async function findAllCustomers(): Promise<CustomerRecord[]> {
  const result = await pool.query<CustomerRecord>(
    `SELECT
       id,
       customer_code,
       name,
       email,
       phone,
       address,
       created_at,
       updated_at
     FROM customers
     ORDER BY name ASC`
  );

  return result.rows;
}

/**
 * Retrieve a customer by ID.
 */
export async function findCustomerById(
  id: string
): Promise<CustomerRecord | null> {
  const result = await pool.query<CustomerRecord>(
    `SELECT
       id,
       customer_code,
       name,
       email,
       phone,
       address,
       created_at,
       updated_at
     FROM customers
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Retrieve a customer by customer code.
 */
export async function findCustomerByCode(
  customerCode: string
): Promise<CustomerRecord | null> {
  const result = await pool.query<CustomerRecord>(
    `SELECT
       id,
       customer_code,
       name,
       email,
       phone,
       address,
       created_at,
       updated_at
     FROM customers
     WHERE customer_code = $1`,
    [customerCode]
  );

  return result.rows[0] ?? null;
}

/**
 * Create a new customer.
 */
export async function createCustomer(
  input: CreateCustomerInput
): Promise<CustomerRecord> {
  const result = await pool.query<CustomerRecord>(
    `INSERT INTO customers (
       customer_code,
       name,
       email,
       phone,
       address
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       id,
       customer_code,
       name,
       email,
       phone,
       address,
       created_at,
       updated_at`,
    [
      input.customerCode,
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.address ?? null,
    ]
  );

  return result.rows[0];
}

/**
 * Update an existing customer.
 * Returns null if the customer does not exist.
 */
export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<CustomerRecord | null> {
  const values: Array<string | null> = [];
  const assignments: string[] = [];

  if (input.customerCode !== undefined) {
    values.push(input.customerCode);
    assignments.push(`customer_code = $${values.length}`);
  }

  if (input.name !== undefined) {
    values.push(input.name);
    assignments.push(`name = $${values.length}`);
  }

  if (input.email !== undefined) {
    values.push(input.email);
    assignments.push(`email = $${values.length}`);
  }

  if (input.phone !== undefined) {
    values.push(input.phone);
    assignments.push(`phone = $${values.length}`);
  }

  if (input.address !== undefined) {
    values.push(input.address);
    assignments.push(`address = $${values.length}`);
  }

  if (assignments.length === 0) {
    throw new Error("No customer fields provided for update.");
  }

  values.push(id);

  const result = await pool.query<CustomerRecord>(
    `UPDATE customers
     SET ${assignments.join(", ")}
     WHERE id = $${values.length}
     RETURNING
       id,
       customer_code,
       name,
       email,
       phone,
       address,
       created_at,
       updated_at`,
    values
  );

  return result.rows[0] ?? null;
}