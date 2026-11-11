import type { RequestHandler } from "express";

import { parsePositiveBigIntId } from "../utils/route-params";

import { AppError } from "../errors/app-error";
import { paginationQuerySchema } from "../validators/common.validator";

import {
  createNewCustomer,
  getAllCustomers,
  getCustomerById,
  updateExistingCustomer,
} from "../services/customer.service";

import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../types/customer.types";

/**
 * Validate customer ID from route parameters.
 */
function getCustomerId(param: unknown): string {
  return parsePositiveBigIntId(param, "INVALID_CUSTOMER_ID", "Customer");
}

/**
 * GET /api/v1/customers
 */
/**
 * GET /api/v1/customers
 */
export const listCustomers: RequestHandler = async (req, res) => {
  const parsed = paginationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }

  const result = await getAllCustomers(parsed.data);

  res.status(200).json({
    status: "success",
    data: result,
  });
};

/**
 * GET /api/v1/customers/:id
 */
export const getCustomer: RequestHandler = async (req, res) => {
  const customerId = getCustomerId(req.params.id);

  const customer = await getCustomerById(customerId);

  res.status(200).json({
    status: "success",
    data: {
      customer,
    },
  });
};

/**
 * POST /api/v1/customers
 */
export const createCustomerController: RequestHandler = async (req, res) => {
  const input = req.body as CreateCustomerInput;

  const customer = await createNewCustomer(input);

  res.status(201).json({
    status: "success",
    message: "Customer created successfully.",
    data: {
      customer,
    },
  });
};

/**
 * PATCH /api/v1/customers/:id
 */
export const updateCustomerController: RequestHandler = async (req, res) => {
  const customerId = getCustomerId(req.params.id);
  const input = req.body as UpdateCustomerInput;

  const customer = await updateExistingCustomer(customerId, input);

  res.status(200).json({
    status: "success",
    message: "Customer updated successfully.",
    data: {
      customer,
    },
  });
};
