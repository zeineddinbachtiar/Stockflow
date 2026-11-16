import type {
  StockMovement,
  StockMovementType,
} from "../inventory/inventory.types";

export interface StockMovementListData {
  movements: StockMovement[];
  total: number;
  limit: number;
  offset: number;
}

export interface StockMovementQueryParams {
  warehouseId?: string;
  productId?: string;
  movementType?: StockMovementType;
  limit: number;
  offset: number;
}
