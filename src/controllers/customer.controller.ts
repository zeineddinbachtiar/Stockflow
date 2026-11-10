import type { RequestHandler, Response } from "express";

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
function getCustomerId(
  param: unknown,
  res: Response
): string | null {
  if (
    typeof param !== "string" ||
    !/^[1-9]\d*$/.test(param)
  ) {
    res.status(400).json({
      status: "error",
      code: "INVALID_CUSTOMER_ID",
      message: "Customer ID must be a positive integer.",
    });

    return null;
  }

  try {
    const id = BigInt(param);
    const maxId = 9223372036854775807n;

    if (id > maxId) {
      res.status(400).json({
        status: "error",
        code: "INVALID_CUSTOMER_ID",
        message: "Customer ID exceeds the maximum supported value.",
      });

      return null;
    }
  } catch {
    res.status(400).json({
      status: "error",
      code: "INVALID_CUSTOMER_ID",
      message: "Customer ID must be a positive integer.",
    });

    return null;
  }

  return param;
}

/**
 * Handle errors returned by customer service.
 */
function handleCustomerError(
  error: unknown,
  res: Response
): void {
  if (error instanceof CustomerServiceError) {
    const statusCode =
      error.code === "CUSTOMER_NOT_FOUND" ? 404 : 409;

    res.status(statusCode).json({
      status: "error",
      code: error.code,
      message: error.message,
    });

    return;
  }

  console.error("Customer controller error:", error);

  res.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
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
    const customerId = getCustomerId(req.params.id, res);

    if (!customerId) return;

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
    const customerId = getCustomerId(req.params.id, res);

    if (!customerId) return;

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