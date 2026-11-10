
import type { PublicStockMovement } from "./stock-movement.types";

export interface InventoryBalanceRecord {
  id: string;
  warehouse_id: string;
  product_id: string;
  quantity_on_hand: number;
  reorder_level: number;
  updated_at: Date;
}

export interface InventoryRecord extends InventoryBalanceRecord {
  warehouse_code: string;
  warehouse_name: string;
  warehouse_is_active: boolean;
  product_sku: string;
  product_name: string;
  product_is_active: boolean;
}

export interface PublicInventory {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseIsActive: boolean;
  productId: string;
  productSku: string;
  productName: string;
  productIsActive: boolean;
  quantityOnHand: number;
  reorderLevel: number;
  isLowStock: boolean;
  updatedAt: Date;
}

export interface InventoryQuery {
  warehouseId?: string;
  productId?: string;
  lowStock?: boolean;
  limit: number;
  offset: number;
}

export interface InventoryListResult {
  items: InventoryRecord[];
  total: number;
}

export interface StockOperationInput {
  warehouseId: string;
  productId: string;
  quantity: number;
  reason?: string | null;
}

export interface StockAdjustmentInput {
  warehouseId: string;
  productId: string;
  quantityDelta: number;
  reason: string;
}

export interface ReorderLevelInput {
  reorderLevel: number;
}

export interface InventoryOperationResult {
  inventory: PublicInventory;
  movement: PublicStockMovement;
}
