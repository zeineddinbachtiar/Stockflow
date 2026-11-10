
import { z } from "zod";

const MAX_INTEGER = 2147483647;

export const positiveOrderIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "ID must be a positive integer")
  .refine(
    (value) => {
      try {
        return BigInt(value) <= 9223372036854775807n;
      } catch {
        return false;
      }
    },
    "ID is outside the BIGINT range"
  );

const orderItemSchema = z.object({
  productId: positiveOrderIdSchema,
  quantity: z.number().int().min(1).max(MAX_INTEGER)
}).strict();

const orderItemsSchema = z
  .array(orderItemSchema)
  .min(1)
  .max(100)
  .superRefine((items, context) => {
    const seen = new Set<string>();

    items.forEach((item, index) => {
      if (seen.has(item.productId)) {
        context.addIssue({
          code: "custom",
          path: [index, "productId"],
          message: "A product can only appear once in an order"
        });
      }

      seen.add(item.productId);
    });
  });

export const createOrderSchema = z.object({
  customerId: positiveOrderIdSchema,
  warehouseId: positiveOrderIdSchema,
  items: orderItemsSchema
}).strict();

export const updateOrderSchema = z
  .object({
    customerId: positiveOrderIdSchema.optional(),
    warehouseId: positiveOrderIdSchema.optional(),
    items: orderItemsSchema.optional()
  })
  .strict()
  .refine(
    (value) =>
      value.customerId !== undefined ||
      value.warehouseId !== undefined ||
      value.items !== undefined,
    "At least one field must be provided"
  );

export const orderQuerySchema = z.object({
  customerId: positiveOrderIdSchema.optional(),
  warehouseId: positiveOrderIdSchema.optional(),
  status: z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1000000).default(0)
}).strict();
