export type StockMovementType =
  "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "ORDER_CONFIRM" | "ORDER_CANCEL";

export type ManualMovementType = "RECEIPT" | "ISSUE" | "ADJUSTMENT";

export interface StockMovementRecord {
  id: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  performed_by: string;
  performed_by_name: string;
  order_id: string | null;
  movement_type: StockMovementType;
  quantity_delta: number;
  reason: string | null;
  created_at: Date;
}

export interface PublicStockMovement {
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
  createdAt: Date;
}

export interface StockMovementInsertInput {
  warehouseId: string;
  productId: string;
  performedBy: string;
  orderId: string | null;
  movementType: StockMovementType;
  quantityDelta: number;
  reason?: string | null;
}

export interface StockMovementQuery {
  warehouseId?: string;
  productId?: string;
  movementType?: StockMovementType;
  limit: number;
  offset: number;
}

export interface StockMovementListResult {
  items: StockMovementRecord[];
  total: number;
}
