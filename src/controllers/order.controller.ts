
import type { Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { parsePositiveBigIntId } from "../utils/route-params";

import {
  cancelOrder,
  confirmOrder,
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder
} from "../services/order.service";

import {
  orderQuerySchema
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

function getActor(req: Request): OrderActor {
  if (!req.user) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required."
    );
  }

  return {
    id: req.user.id,
    role: req.user.role
  };
}

function getOrderId(param: unknown): string {
  return parsePositiveBigIntId(
    param,
    "INVALID_ORDER_ID",
    "Order"
  );
}

/**
 * Read PostgreSQL SQLSTATE code from an unknown error.
 */


function handleOrderError(
  _res: Response,
  error: unknown
): never {
  throw error;
}

export async function listOrders(
  req: Request,
  res: Response
): Promise<Response> {
  const actor = getActor(req);

  const parsed = orderQuerySchema.safeParse(req.query);

  if (!parsed.success) {
  throw new AppError(
    400,
    "VALIDATION_ERROR",
    "Request validation failed.",
    parsed.error.issues.map((issue) => ({
      field: issue.path.map(String).join("."),
      message: issue.message
    }))
  );
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

  const orderId = getOrderId(req.params.id);

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

  const orderId = getOrderId(req.params.id);

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

  const orderId = getOrderId(req.params.id);

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

  const orderId = getOrderId(req.params.id);

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
