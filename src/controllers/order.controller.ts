
import type { Request, Response } from "express";

import {
  cancelOrder,
  confirmOrder,
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder
} from "../services/order.service";

import {
  orderQuerySchema,
  positiveOrderIdSchema
} from "../validators/order.validator";

import type {
  CreateOrderInput,
  OrderQuery,
  UpdateOrderInput
} from "../types/order.types";

import type { UserRole } from "../types/user.types";

type OrderActor = {
  id: string;
  role: UserRole;
};

function getActor(req: Request): OrderActor | null {
  if (!req.user) {
    return null;
  }

  return {
    id: req.user.id,
    role: req.user.role
  };
}

function getOrderId(
  req: Request,
  res: Response
): string | null {
  const parsed = positiveOrderIdSchema.safeParse(req.params.id);

  if (!parsed.success) {
    res.status(400).json({
      status: "error",
      code: "INVALID_ORDER_ID",
      message: "Order ID must be a positive integer"
    });

    return null;
  }

  return parsed.data;
}

/**
 * Read PostgreSQL SQLSTATE code from an unknown error.
 */
function hasPostgresErrorCode(
  error: unknown,
  expectedCode: string
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === expectedCode
  );
}


function handleOrderError(
  res: Response,
  error: unknown
): Response {
  // PostgreSQL unique constraint violation.
  if (hasPostgresErrorCode(error, "23505")) {
    return res.status(409).json({
      status: "error",
      code: "DUPLICATE_ORDER",
      message: "An order or related record already exists."
    });
  }

  const code =
    error instanceof Error
      ? error.message
      : "INTERNAL_SERVER_ERROR";

  const notFoundErrors: Record<string, string> = {
    ORDER_NOT_FOUND: "Order was not found",
    CUSTOMER_NOT_FOUND: "Customer was not found",
    WAREHOUSE_NOT_FOUND: "Warehouse was not found or is inactive",
    PRODUCT_NOT_FOUND_OR_INACTIVE: "One or more products were not found or are inactive",
    ORDER_WAREHOUSE_NOT_FOUND: "The order warehouse no longer exists",
    ORDER_PRODUCT_NOT_FOUND: "One or more order products no longer exist",
    INVENTORY_NOT_FOUND: "Inventory balance was not found"
  };

  const conflictErrors: Record<string, string> = {
    ORDER_NOT_DRAFT: "Only draft orders can be confirmed or updated",
    ORDER_ALREADY_CANCELLED: "Order has already been cancelled",
    ORDER_HAS_NO_ITEMS: "An order must contain at least one item",
    INSUFFICIENT_STOCK: "Insufficient stock to confirm this order",
    INVALID_ORDER_STATUS: "Order status does not allow this operation",
    ORDER_PRODUCT_INACTIVE: "One or more products in this order are inactive and cannot be confirmed"
  };

  if (code === "ORDER_ACCESS_DENIED") {
    return res.status(403).json({
      status: "error",
      code,
      message: "You are not allowed to perform this order operation"
    });
  }

  if (notFoundErrors[code]) {
    return res.status(404).json({
      status: "error",
      code,
      message: notFoundErrors[code]
    });
  }

  if (conflictErrors[code]) {
    return res.status(409).json({
      status: "error",
      code,
      message: conflictErrors[code]
    });
  }

  if (code === "STOCK_QUANTITY_LIMIT_EXCEEDED") {
    return res.status(422).json({
      status: "error",
      code,
      message: "Stock quantity exceeds the supported integer limit"
    });
  }

  console.error("Order controller error:", error);

  return res.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred"
  });
}


export async function listOrders(
  req: Request,
  res: Response
): Promise<Response> {
  const actor = getActor(req);

  if (!actor) {
    return res.status(401).json({
      status: "error",
      code: "UNAUTHENTICATED",
      message: "Authentication is required"
    });
  }

  const parsed = orderQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_ERROR",
      message: "Invalid order query parameters",
      errors: parsed.error.issues
    });
  }

  try {
    const result = await getAllOrders(
      parsed.data as OrderQuery,
      actor
    );

    return res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    return handleOrderError(res, error);
  }
}

export async function getOrder(
  req: Request,
  res: Response
): Promise<Response> {
  const actor = getActor(req);

  if (!actor) {
    return res.status(401).json({
      status: "error",
      code: "UNAUTHENTICATED",
      message: "Authentication is required"
    });
  }

  const orderId = getOrderId(req, res);

  if (!orderId) {
    return res;
  }

  try {
    const order = await getOrderById(orderId, actor);

    if (!order) {
      return res.status(404).json({
        status: "error",
        code: "ORDER_NOT_FOUND",
        message: "Order was not found"
      });
    }

    return res.status(200).json({
      status: "success",
      data: { order }
    });
  } catch (error) {
    return handleOrderError(res, error);
  }
}

export async function createOrderController(
  req: Request,
  res: Response
): Promise<Response> {
  const actor = getActor(req);

  if (!actor) {
    return res.status(401).json({
      status: "error",
      code: "UNAUTHENTICATED",
      message: "Authentication is required"
    });
  }

  try {
    const order = await createOrder(
      req.body as CreateOrderInput,
      actor
    );

    return res.status(201).json({
      status: "success",
      data: { order }
    });
  } catch (error) {
    return handleOrderError(res, error);
  }
}

export async function updateOrderController(
  req: Request,
  res: Response
): Promise<Response> {
  const actor = getActor(req);

  if (!actor) {
    return res.status(401).json({
      status: "error",
      code: "UNAUTHENTICATED",
      message: "Authentication is required"
    });
  }

  const orderId = getOrderId(req, res);

  if (!orderId) {
    return res;
  }

  try {
    const order = await updateOrder(
      orderId,
      req.body as UpdateOrderInput,
      actor
    );

    return res.status(200).json({
      status: "success",
      data: { order }
    });
  } catch (error) {
    return handleOrderError(res, error);
  }
}

export async function confirmOrderController(
  req: Request,
  res: Response
): Promise<Response> {
  const actor = getActor(req);

  if (!actor) {
    return res.status(401).json({
      status: "error",
      code: "UNAUTHENTICATED",
      message: "Authentication is required"
    });
  }

  const orderId = getOrderId(req, res);

  if (!orderId) {
    return res;
  }

  try {
    const order = await confirmOrder(orderId, actor);

    return res.status(200).json({
      status: "success",
      data: { order }
    });
  } catch (error) {
    return handleOrderError(res, error);
  }
}

export async function cancelOrderController(
  req: Request,
  res: Response
): Promise<Response> {
  const actor = getActor(req);

  if (!actor) {
    return res.status(401).json({
      status: "error",
      code: "UNAUTHENTICATED",
      message: "Authentication is required"
    });
  }

  const orderId = getOrderId(req, res);

  if (!orderId) {
    return res;
  }

  try {
    const order = await cancelOrder(orderId, actor);

    return res.status(200).json({
      status: "success",
      data: { order }
    });
  } catch (error) {
    return handleOrderError(res, error);
  }
}
