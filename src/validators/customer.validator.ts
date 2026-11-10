import { z } from "zod";

/**
 * Validate customer code.
 */
const customerCodeSchema = z
  .string()
  .trim()
  .min(1, "Customer code is required.")
  .max(30, "Customer code must not exceed 30 characters.");

/**
 * Validate customer name.
 */
const customerNameSchema = z
  .string()
  .trim()
  .min(1, "Customer name is required.")
  .max(150, "Customer name must not exceed 150 characters.");

/**
 * Validate customer email.
 */
const customerEmailSchema = z
  .string()
  .trim()
  .max(150, "Customer email must not exceed 150 characters.")
  .email("Invalid email format.")
  .nullable()
  .optional();

/**
 * Validate customer phone.
 */
const customerPhoneSchema = z
  .string()
  .trim()
  .max(30, "Customer phone must not exceed 30 characters.")
  .nullable()
  .optional();

/**
 * Validate customer address.
 */
const customerAddressSchema = z
  .string()
  .trim()
  .max(5000, "Customer address must not exceed 5000 characters.")
  .nullable()
  .optional();

/**
 * Validation schema for creating a customer.
 */
export const createCustomerSchema = z
  .object({
    customerCode: customerCodeSchema,
    name: customerNameSchema,
    email: customerEmailSchema,
    phone: customerPhoneSchema,
    address: customerAddressSchema,
  })
  .strict();

/**
 * Validation schema for updating a customer.
 */
export const updateCustomerSchema = z
  .object({
    customerCode: customerCodeSchema.optional(),
    name: customerNameSchema.optional(),
    email: customerEmailSchema,
    phone: customerPhoneSchema,
    address: customerAddressSchema,
  })
  .strict()
  .refine(
    (data) =>
      data.customerCode !== undefined ||
      data.name !== undefined ||
      data.email !== undefined ||
      data.phone !== undefined ||
      data.address !== undefined,
    {
      message: "At least one field must be provided for update.",
    }
  );