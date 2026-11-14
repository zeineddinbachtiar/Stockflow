import { apiRequest } from "../../lib/api";
import type { ApiEnvelope } from "../../types/auth.types";

import type {
  Category,
  CategoryListData,
  CategoryPayload,
  UpdateCategoryPayload,
} from "./category.types";

export async function getCategories(
  accessToken: string,
  limit = 10,
  offset = 0,
): Promise<CategoryListData> {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const response = await apiRequest<ApiEnvelope<CategoryListData>>(
    `/categories?${query.toString()}`,
    {},
    accessToken,
  );

  return response.data;
}

export async function getCategoryById(
  accessToken: string,
  id: string,
): Promise<Category> {
  const response = await apiRequest<ApiEnvelope<{ category: Category }>>(
    `/categories/${encodeURIComponent(id)}`,
    {},
    accessToken,
  );

  return response.data.category;
}

export async function createCategory(
  accessToken: string,
  payload: CategoryPayload,
): Promise<Category> {
  const response = await apiRequest<ApiEnvelope<{ category: Category }>>(
    "/categories",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );

  return response.data.category;
}

export async function updateCategory(
  accessToken: string,
  id: string,
  payload: UpdateCategoryPayload,
): Promise<Category> {
  const response = await apiRequest<ApiEnvelope<{ category: Category }>>(
    `/categories/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    accessToken,
  );

  return response.data.category;
}

export async function deactivateCategory(
  accessToken: string,
  id: string,
): Promise<Category> {
  const response = await apiRequest<ApiEnvelope<{ category: Category }>>(
    `/categories/${encodeURIComponent(id)}/deactivate`,
    {
      method: "PATCH",
    },
    accessToken,
  );

  return response.data.category;
}
