import { apiRequest } from "../../lib/api";
import type { ApiEnvelope } from "../../types/auth.types";

import type {
  Customer,
  CustomerListData,
  CustomerPayload,
  UpdateCustomerPayload,
} from "./customer.types";

export async function getCustomers(
  accessToken: string,
  limit = 10,
  offset = 0,
): Promise<CustomerListData> {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const response = await apiRequest<ApiEnvelope<CustomerListData>>(
    `/customers?${query.toString()}`,
    {},
    accessToken,
  );

  return response.data;
}

export async function getCustomerById(
  accessToken: string,
  id: string,
): Promise<Customer> {
  const response = await apiRequest<ApiEnvelope<{ customer: Customer }>>(
    `/customers/${encodeURIComponent(id)}`,
    {},
    accessToken,
  );

  return response.data.customer;
}

export async function createCustomer(
  accessToken: string,
  payload: CustomerPayload,
): Promise<Customer> {
  const response = await apiRequest<ApiEnvelope<{ customer: Customer }>>(
    "/customers",
    { method: "POST", body: JSON.stringify(payload) },
    accessToken,
  );

  return response.data.customer;
}

export async function updateCustomer(
  accessToken: string,
  id: string,
  payload: UpdateCustomerPayload,
): Promise<Customer> {
  const response = await apiRequest<ApiEnvelope<{ customer: Customer }>>(
    `/customers/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    accessToken,
  );

  return response.data.customer;
}
