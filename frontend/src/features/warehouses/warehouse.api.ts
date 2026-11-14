import { apiRequest } from "../../lib/api";
import type { ApiEnvelope } from "../../types/auth.types";

import type {
  Warehouse,
  WarehouseListData,
  WarehousePayload,
  UpdateWarehousePayload,
} from "./warehouse.types";

export async function getWarehouses(
  accessToken: string,
  limit = 10,
  offset = 0,
): Promise<WarehouseListData> {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const response = await apiRequest<ApiEnvelope<WarehouseListData>>(
    `/warehouses?${query.toString()}`,
    {},
    accessToken,
  );

  return response.data;
}

export async function getWarehouseById(
  accessToken: string,
  id: string,
): Promise<Warehouse> {
  const response = await apiRequest<ApiEnvelope<{ warehouse: Warehouse }>>(
    `/warehouses/${encodeURIComponent(id)}`,
    {},
    accessToken,
  );

  return response.data.warehouse;
}

export async function createWarehouse(
  accessToken: string,
  payload: WarehousePayload,
): Promise<Warehouse> {
  const response = await apiRequest<ApiEnvelope<{ warehouse: Warehouse }>>(
    "/warehouses",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );

  return response.data.warehouse;
}

export async function updateWarehouse(
  accessToken: string,
  id: string,
  payload: UpdateWarehousePayload,
): Promise<Warehouse> {
  const response = await apiRequest<ApiEnvelope<{ warehouse: Warehouse }>>(
    `/warehouses/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    accessToken,
  );

  return response.data.warehouse;
}

export async function deactivateWarehouse(
  accessToken: string,
  id: string,
): Promise<Warehouse> {
  const response = await apiRequest<ApiEnvelope<{ warehouse: Warehouse }>>(
    `/warehouses/${encodeURIComponent(id)}/deactivate`,
    {
      method: "PATCH",
    },
    accessToken,
  );

  return response.data.warehouse;
}

export async function reactivateWarehouse(
  accessToken: string,
  id: string,
): Promise<Warehouse> {
  const response = await apiRequest<ApiEnvelope<{ warehouse: Warehouse }>>(
    `/warehouses/${encodeURIComponent(id)}/reactivate`,
    {
      method: "PATCH",
    },
    accessToken,
  );

  return response.data.warehouse;
}
