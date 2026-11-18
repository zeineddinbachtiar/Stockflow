export type { Category } from "../categories/category.types";
export interface Product {
  id: string;
  categoryId: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListParams {
  categoryId?: string;
  status?: "active" | "inactive";
  search?: string;
  limit: number;
  offset: number;
}

export interface ProductListData {
  products: Product[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProductPayload {
  categoryId: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: string;
}

export type UpdateProductPayload = Partial<ProductPayload>;
