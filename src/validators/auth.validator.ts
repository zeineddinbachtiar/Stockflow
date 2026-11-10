
import { z } from "zod";

/**
 * Register request validation schema.
 */
export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must contain at least 2 characters.")
      .max(100, "Full name cannot exceed 100 characters."),

    email: z
      .string()
      .trim()
      .email("Invalid email format.")
      .max(150, "Email cannot exceed 150 characters.")
      .toLowerCase(),

    password: z
      .string()
      .min(8, "Password must contain at least 8 characters.")
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Password must not exceed 72 UTF-8 bytes."
      )
  })
  .strict();

/**
 * Login request validation schema.
 */
export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Invalid email format.")
      .max(150, "Email cannot exceed 150 characters.")
      .toLowerCase(),

    password: z
      .string()
      .min(1, "Password is required.")
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Invalid password length."
      )
  })
  .strict();

/**
 * Export inferred request types.
 */
export type RegisterRequest = z.infer<
  typeof registerSchema
>;

export type LoginRequest = z.infer<
  typeof loginSchema
>;
