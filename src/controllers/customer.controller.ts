import type { RequestHandler, Response } from "express";
import { parsePositiveBigIntId } from "../utils/route-params";

import {
  CustomerServiceError,
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
  return parsePositiveBigIntId(
    param,
    "INVALID_CUSTOMER_ID",
    "Customer"
  );
}

/**
 * Handle errors returned by customer service.
 */
function handleCustomerError(
  error: unknown,
  _res: Response
): never {
  throw error;
}

/**
 * GET /api/v1/customers
 */
export const listCustomers: RequestHandler = async (_req, res) => {
  try {
    const customers = await getAllCustomers();

    res.status(200).json({
      status: "success",
      data: {
        customers,
      },
    });
  } catch (error: unknown) {
    handleCustomerError(error, res);
  }
};

/**
 * GET /api/v1/customers/:id
 */
export const getCustomer: RequestHandler = async (req, res) => {
  try {
    const customerId = getCustomerId(req.params.id);

    const customer = await getCustomerById(customerId);

    res.status(200).json({
      status: "success",
      data: {
        customer,
      },
    });
  } catch (error: unknown) {
    handleCustomerError(error, res);
  }
};

/**
 * POST /api/v1/customers
 */
export const createCustomerController: RequestHandler = async (
  req,
  res
) => {
  try {
    const input = req.body as CreateCustomerInput;

    const customer = await createNewCustomer(input);

    res.status(201).json({
      status: "success",
      message: "Customer created successfully.",
      data: {
        customer,
      },
    });
  } catch (error: unknown) {
    handleCustomerError(error, res);
  }
};

/**
 * PATCH /api/v1/customers/:id
 */
export const updateCustomerController: RequestHandler = async (
  req,
  res
) => {
  try {
    const customerId = getCustomerId(req.params.id);

    const input = req.body as UpdateCustomerInput;

    const customer = await updateExistingCustomer(
      customerId,
      input
    );

    res.status(200).json({
      status: "success",
      message: "Customer updated successfully.",
      data: {
        customer,
      },
    });
  } catch (error: unknown) {
    handleCustomerError(error, res);
  }
};