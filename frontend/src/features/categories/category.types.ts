export interface Category {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryListData {
  categories: Category[];
  total: number;
  limit: number;
  offset: number;
}

export interface CategoryPayload {
  name: string;
  description: string | null;
}

export type UpdateCategoryPayload = Partial<CategoryPayload>;
