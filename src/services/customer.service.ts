import {
  createCustomer,
  findAllCustomers,
  findCustomerByCode,
  findCustomerById,
  updateCustomer,
} from "../repositories/customer.repositories";

import type { PaginationQuery } from "../types/common.types";

import { AppError } from "../errors/app-error";
import { hasPostgresErrorCode } from "../utils/postgres-errors";

import type {
  CustomerRecord,
  PublicCustomer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../types/customer.types";

/**
 * Convert database customer record into public response format.
 */
function toPublicCustomer(customer: CustomerRecord): PublicCustomer {
  return {
    id: customer.id,
    customerCode: customer.customer_code,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  };
}

/**
 * Retrieve all customers.
 */
/**
 * Retrieve all customers with pagination.
 */
export async function getAllCustomers(query: PaginationQuery): Promise<{
  customers: PublicCustomer[];
  total: number;
  limit: number;
  offset: number;
}> {
  const result = await findAllCustomers(query);

  return {
    customers: result.items.map(toPublicCustomer),
    total: result.total,
    limit: query.limit,
    offset: query.offset,
  };
}

/**
 * Retrieve a customer by ID.
 */
export async function getCustomerById(id: string): Promise<PublicCustomer> {
  const customer = await findCustomerById(id);

  if (!customer) {
    throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  }

  return toPublicCustomer(customer);
}

/**
 * Create a new customer.
 */
export async function createNewCustomer(
  input: CreateCustomerInput,
): Promise<PublicCustomer> {
  const normalizedInput: CreateCustomerInput = {
    customerCode: input.customerCode.trim().toUpperCase(),
    name: input.name.trim(),
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
  };

  // Check whether the customer code has already been used.
  const existingCustomer = await findCustomerByCode(
    normalizedInput.customerCode,
  );

  if (existingCustomer) {
    throw new AppError(
      409,
      "CUSTOMER_CODE_ALREADY_EXISTS",
      "Customer code is already registered.",
    );
  }

  try {
    const customer = await createCustomer(normalizedInput);

    return toPublicCustomer(customer);
  } catch (error: unknown) {
    // Handle duplicate-code race conditions.
    if (hasPostgresErrorCode(error, "23505")) {
      throw new AppError(
        409,
        "CUSTOMER_CODE_ALREADY_EXISTS",
        "Customer code is already registered.",
      );
    }

    throw error;
  }
}

/**
 * Update an existing customer.
 */
export async function updateExistingCustomer(
  id: string,
  input: UpdateCustomerInput,
): Promise<PublicCustomer> {
  const currentCustomer = await findCustomerById(id);

  if (!currentCustomer) {
    throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  }

  const normalizedInput: UpdateCustomerInput = {};

  // Normalize and check customer code uniqueness.
  if (input.customerCode !== undefined) {
    const normalizedCode = input.customerCode.trim().toUpperCase();

    const existingCustomer = await findCustomerByCode(normalizedCode);

    if (existingCustomer && existingCustomer.id !== id) {
      throw new AppError(
        409,
        "CUSTOMER_CODE_ALREADY_EXISTS",
        "Customer code is already registered.",
      );
    }

    normalizedInput.customerCode = normalizedCode;
  }

  if (input.name !== undefined) {
    normalizedInput.name = input.name.trim();
  }

  if (input.email !== undefined) {
    normalizedInput.email = input.email?.trim().toLowerCase() || null;
  }

  if (input.phone !== undefined) {
    normalizedInput.phone = input.phone?.trim() || null;
  }

  if (input.address !== undefined) {
    normalizedInput.address = input.address?.trim() || null;
  }

  try {
    const updatedCustomer = await updateCustomer(id, normalizedInput);

    if (!updatedCustomer) {
      throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    return toPublicCustomer(updatedCustomer);
  } catch (error: unknown) {
    // Handle duplicate-code race conditions.
    if (hasPostgresErrorCode(error, "23505")) {
      throw new AppError(
        409,
        "CUSTOMER_CODE_ALREADY_EXISTS",
        "Customer code is already registered.",
      );
    }

    throw error;
  }
}
