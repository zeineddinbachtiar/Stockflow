import { apiRequest } from "../../lib/api";
import type { ApiEnvelope } from "../../types/auth.types";

import type {
  InventoryBalance,
  InventoryListData,
  InventoryQueryParams,
  InventoryOperationResult,
  ReorderLevelPayload,
  StockAdjustmentPayload,
  StockOperationPayload,
} from "./inventory.types";

export async function getInventory(
  accessToken: string,
  params: InventoryQueryParams,
): Promise<InventoryListData> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });

  if (params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (params.productId) query.set("productId", params.productId);
  if (params.lowStock !== undefined) {
    query.set("lowStock", String(params.lowStock));
  }

  const response = await apiRequest<ApiEnvelope<InventoryListData>>(
    `/inventory?${query.toString()}`,
    {},
    accessToken,
  );

  return response.data;
}

export async function getInventoryById(
  accessToken: string,
  id: string,
): Promise<InventoryBalance> {
  const response = await apiRequest<
    ApiEnvelope<{ inventory: InventoryBalance }>
  >(`/inventory/${encodeURIComponent(id)}`, {}, accessToken);

  return response.data.inventory;
}

export async function receiveStock(
  accessToken: string,
  payload: StockOperationPayload,
): Promise<InventoryOperationResult> {
  const response = await apiRequest<ApiEnvelope<InventoryOperationResult>>(
    "/inventory/receipts",
    { method: "POST", body: JSON.stringify(payload) },
    accessToken,
  );

  return response.data;
}

export async function issueStock(
  accessToken: string,
  payload: StockOperationPayload,
): Promise<InventoryOperationResult> {
  const response = await apiRequest<ApiEnvelope<InventoryOperationResult>>(
    "/inventory/issues",
    { method: "POST", body: JSON.stringify(payload) },
    accessToken,
  );

  return response.data;
}

export async function adjustStock(
  accessToken: string,
  payload: StockAdjustmentPayload,
): Promise<InventoryOperationResult> {
  const response = await apiRequest<ApiEnvelope<InventoryOperationResult>>(
    "/inventory/adjustments",
    { method: "POST", body: JSON.stringify(payload) },
    accessToken,
  );

  return response.data;
}

export async function updateReorderLevel(
  accessToken: string,
  id: string,
  payload: ReorderLevelPayload,
): Promise<InventoryBalance> {
  const response = await apiRequest<
    ApiEnvelope<{ inventory: InventoryBalance }>
  >(
    `/inventory/${encodeURIComponent(id)}/reorder-level`,
    { method: "PATCH", body: JSON.stringify(payload) },
    accessToken,
  );

  return response.data.inventory;
}
