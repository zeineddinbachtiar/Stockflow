export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseListData {
  warehouses: Warehouse[];
  total: number;
  limit: number;
  offset: number;
}

export interface WarehousePayload {
  code: string;
  name: string;
  address: string | null;
}

export type UpdateWarehousePayload = Partial<WarehousePayload>;