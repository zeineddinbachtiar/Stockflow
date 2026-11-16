import { apiRequest } from "../../lib/api";
import type { ApiEnvelope } from "../../types/auth.types";

import type {
  CreateOrderPayload,
  Order,
  OrderListData,
  OrderQueryParams,
  UpdateOrderPayload,
} from "./order.types";

export async function getOrders(
  accessToken: string,
  params: OrderQueryParams,
): Promise<OrderListData> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });

  if (params.customerId) query.set("customerId", params.customerId);
  if (params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (params.status) query.set("status", params.status);

  const response = await apiRequest<ApiEnvelope<OrderListData>>(
    `/orders?${query.toString()}`,
    {},
    accessToken,
  );

  return response.data;
}

export async function getOrderById(
  accessToken: string,
  id: string,
): Promise<Order> {
  const response = await apiRequest<ApiEnvelope<{ order: Order }>>(
    `/orders/${encodeURIComponent(id)}`,
    {},
    accessToken,
  );

  return response.data.order;
}

export async function createOrder(
  accessToken: string,
  payload: CreateOrderPayload,
): Promise<Order> {
  const response = await apiRequest<ApiEnvelope<{ order: Order }>>(
    "/orders",
    { method: "POST", body: JSON.stringify(payload) },
    accessToken,
  );

  return response.data.order;
}

export async function updateOrder(
  accessToken: string,
  id: string,
  payload: UpdateOrderPayload,
): Promise<Order> {
  const response = await apiRequest<ApiEnvelope<{ order: Order }>>(
    `/orders/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    accessToken,
  );

  return response.data.order;
}

export async function confirmOrder(
  accessToken: string,
  id: string,
): Promise<Order> {
  const response = await apiRequest<ApiEnvelope<{ order: Order }>>(
    `/orders/${encodeURIComponent(id)}/confirm`,
    { method: "POST" },
    accessToken,
  );

  return response.data.order;
}

export async function cancelOrder(
  accessToken: string,
  id: string,
): Promise<Order> {
  const response = await apiRequest<ApiEnvelope<{ order: Order }>>(
    `/orders/${encodeURIComponent(id)}/cancel`,
    { method: "POST" },
    accessToken,
  );

  return response.data.order;
}
