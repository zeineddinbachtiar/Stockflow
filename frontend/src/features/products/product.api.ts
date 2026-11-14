import { apiRequest } from "../../lib/api";
import type { ApiEnvelope } from "../../types/auth.types";

import type {
  Category,
  Product,
  ProductListData,
  ProductListParams,
  ProductPayload,
  UpdateProductPayload,
} from "./product.types";

export async function getProducts(
  accessToken: string,
  params: ProductListParams,
): Promise<ProductListData> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  const response = await apiRequest<ApiEnvelope<ProductListData>>(
    `/products?${query.toString()}`,
    {},
    accessToken,
  );

  return response.data;
}

export async function getProductById(
  accessToken: string,
  id: string,
): Promise<Product> {
  const response = await apiRequest<ApiEnvelope<{ product: Product }>>(
    `/products/${encodeURIComponent(id)}`,
    {},
    accessToken,
  );

  return response.data.product;
}

export async function getCategories(accessToken: string): Promise<Category[]> {
  const response = await apiRequest<
    ApiEnvelope<{
      categories: Category[];
      total: number;
      limit: number;
      offset: number;
    }>
  >("/categories?limit=100&offset=0", {}, accessToken);

  return response.data.categories;
}

export async function createProduct(
  accessToken: string,
  payload: ProductPayload,
): Promise<Product> {
  const response = await apiRequest<ApiEnvelope<{ product: Product }>>(
    "/products",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    accessToken,
  );

  return response.data.product;
}

export async function updateProduct(
  accessToken: string,
  id: string,
  payload: UpdateProductPayload,
): Promise<Product> {
  const response = await apiRequest<ApiEnvelope<{ product: Product }>>(
    `/products/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    accessToken,
  );

  return response.data.product;
}

export async function deactivateProduct(
  accessToken: string,
  id: string,
): Promise<Product> {
  const response = await apiRequest<ApiEnvelope<{ product: Product }>>(
    `/products/${encodeURIComponent(id)}/deactivate`,
    {
      method: "PATCH",
    },
    accessToken,
  );

  return response.data.product;
}
