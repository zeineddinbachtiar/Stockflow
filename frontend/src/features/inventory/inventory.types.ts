export type StockMovementType =
  "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "ORDER_CONFIRM" | "ORDER_CANCEL";

export interface InventoryBalance {
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
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  productSku: string;
  productName: string;
  performedBy: string;
  performedByName: string;
  orderId: string | null;
  movementType: StockMovementType;
  quantityDelta: number;
  reason: string | null;
  createdAt: string;
}

export interface InventoryListData {
  inventory: InventoryBalance[];
  total: number;
  limit: number;
  offset: number;
}

export interface InventoryQueryParams {
  warehouseId?: string;
  productId?: string;
  lowStock?: boolean;
  limit: number;
  offset: number;
}

export interface StockOperationPayload {
  warehouseId: string;
  productId: string;
  quantity: number;
  reason?: string | null;
}

export interface StockAdjustmentPayload {
  warehouseId: string;
  productId: string;
  quantityDelta: number;
  reason: string;
}

export interface ReorderLevelPayload {
  reorderLevel: number;
}

export interface InventoryOperationResult {
  inventory: InventoryBalance;
  movement: StockMovement;
}
