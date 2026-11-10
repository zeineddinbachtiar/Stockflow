
import {
  findAllStockMovements,
  findStockMovementById,
} from "../repositories/stock-movement.repositories";

import type {
  StockMovementRecord,
  PublicStockMovement,
  StockMovementQuery,
} from "../types/stock-movement.types";

/**
 * Convert database movement record into public response format.
 */
export function toPublicStockMovement(
  movement: StockMovementRecord
): PublicStockMovement {
  return {
    id: movement.id,
    warehouseId: movement.warehouse_id,
    warehouseCode: movement.warehouse_code,
    warehouseName: movement.warehouse_name,
    productId: movement.product_id,
    productSku: movement.product_sku,
    productName: movement.product_name,
    performedBy: movement.performed_by,
    performedByName: movement.performed_by_name,
    orderId: movement.order_id,
    movementType: movement.movement_type,
    quantityDelta: movement.quantity_delta,
    reason: movement.reason,
    createdAt: movement.created_at,
  };
}

/**
 * Retrieve stock movement history.
 */
export async function getAllStockMovements(
  query: StockMovementQuery
) {
  const result = await findAllStockMovements(query);

  return {
    movements: result.items.map(toPublicStockMovement),
    total: result.total,
    limit: query.limit,
    offset: query.offset,
  };
}

/**
 * Retrieve a stock movement by ID.
 */
export async function getStockMovementById(
  id: string
): Promise<PublicStockMovement | null> {
  const movement = await findStockMovementById(id);

  if (!movement) {
    return null;
  }

  return toPublicStockMovement(movement);
}
