
export interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PublicWarehouse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  address?: string | null;
}

export interface UpdateWarehouseInput {
  code?: string;
  name?: string;
  address?: string | null;
}
