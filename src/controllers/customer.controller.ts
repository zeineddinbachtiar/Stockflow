import type { RequestHandler } from "express";

import { parsePositiveBigIntId } from "../utils/route-params";

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
export const listCustomers: RequestHandler = async (_req, res) => {
  const customers = await getAllCustomers();

  res.status(200).json({
    status: "success",
    data: {
      customers,
    },
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
