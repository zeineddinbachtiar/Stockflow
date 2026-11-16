import { apiRequest } from "../../lib/api";
import type { ApiEnvelope } from "../../types/auth.types";

import type { StockMovement } from "../inventory/inventory.types";
import type {
  StockMovementListData,
  StockMovementQueryParams,
} from "./stock-movement.types";

export async function getStockMovements(
  accessToken: string,
  params: StockMovementQueryParams,
): Promise<StockMovementListData> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });

  if (params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (params.productId) query.set("productId", params.productId);
  if (params.movementType) query.set("movementType", params.movementType);

  const response = await apiRequest<ApiEnvelope<StockMovementListData>>(
    `/stock-movements?${query.toString()}`,
    {},
    accessToken,
  );

  return response.data;
}

export async function getStockMovementById(
  accessToken: string,
  id: string,
): Promise<StockMovement> {
  const response = await apiRequest<ApiEnvelope<{ movement: StockMovement }>>(
    `/stock-movements/${encodeURIComponent(id)}`,
    {},
    accessToken,
  );

  return response.data.movement;
}
