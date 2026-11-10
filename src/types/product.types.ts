
export interface ProductRecord {
  id: string;
  category_id: string;
  sku: string;
  name: string;
  description: string | null;
  unit_price: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PublicProduct {
  id: string;
  categoryId: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  categoryId: string;
  sku: string;
  name: string;
  description?: string | null;
  unitPrice: string;
}

export interface UpdateProductInput {
  categoryId?: string;
  sku?: string;
  name?: string;
  description?: string | null;
  unitPrice?: string;
}
