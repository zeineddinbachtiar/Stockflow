import { pool } from "../config/database";
import { AppError } from "../errors/app-error";

import {
  ensureInventoryRow,
  findAllInventory,
  findInventoryById,
  findInventoryByIdWithClient,
  lockActiveProduct,
  lockActiveWarehouse,
  lockInventoryBalance,
  updateInventoryQuantity,
  updateInventoryReorderLevel,
} from "../repositories/inventory.repositories";

import {
  insertStockMovement,
  findStockMovementByIdWithClient,
} from "../repositories/stock-movement.repositories";

import { toPublicStockMovement } from "./stock-movement.service";

import type {
  InventoryRecord,
  PublicInventory,
  InventoryQuery,
  StockOperationInput,
  StockAdjustmentInput,
  InventoryOperationResult,
} from "../types/inventory.types";

import type { ManualMovementType } from "../types/stock-movement.types";

const MAX_POSTGRES_INTEGER = 2147483647;

/**
 * Convert database inventory record into public response format.
 */
function toPublicInventory(inventory: InventoryRecord): PublicInventory {
  return {
    id: inventory.id,
    warehouseId: inventory.warehouse_id,
    warehouseCode: inventory.warehouse_code,
    warehouseName: inventory.warehouse_name,
    warehouseIsActive: inventory.warehouse_is_active,
    productId: inventory.product_id,
    productSku: inventory.product_sku,
    productName: inventory.product_name,
    productIsActive: inventory.product_is_active,
    quantityOnHand: inventory.quantity_on_hand,
    reorderLevel: inventory.reorder_level,
    isLowStock: inventory.quantity_on_hand <= inventory.reorder_level,
    updatedAt: inventory.updated_at,
  };
}

/**
 * Retrieve inventory records.
 */
export async function getAllInventory(query: InventoryQuery) {
  const result = await findAllInventory(query);

  return {
    inventory: result.items.map(toPublicInventory),
    total: result.total,
    limit: query.limit,
    offset: query.offset,
  };
}

/**
 * Retrieve inventory detail by ID.
 */
export async function getInventoryById(id: string): Promise<PublicInventory> {
  const inventory = await findInventoryById(id);

  if (!inventory) {
    throw new AppError(
      404,
      "WAREHOUSE_NOT_FOUND",
      "Active warehouse not found.",
    );
  }

  return toPublicInventory(inventory);
}

/**
 * Execute an inventory movement and update the balance
 * in one database transaction.
 */
async function executeStockMovement(
  movementType: ManualMovementType,
  warehouseId: string,
  productId: string,
  performedBy: string,
  quantityDelta: number,
  reason?: string | null,
): Promise<InventoryOperationResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Step 1: Lock and validate the active warehouse.
    const warehouseIsActive = await lockActiveWarehouse(client, warehouseId);

    if (!warehouseIsActive) {
      throw new AppError(
        404,
        "WAREHOUSE_NOT_FOUND",
        "Active warehouse not found.",
      );
    }

    // Step 2: Lock and validate the active product.
    const productIsActive = await lockActiveProduct(client, productId);

    if (!productIsActive) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Active product not found.");
    }

    // Step 3: Ensure the inventory row exists.
    await ensureInventoryRow(client, warehouseId, productId);

    // Step 4: Lock the inventory balance.
    const currentInventory = await lockInventoryBalance(
      client,
      warehouseId,
      productId,
    );

    if (!currentInventory) {
      throw new AppError(
        404,
        "INVENTORY_NOT_FOUND",
        "Inventory record could not be created.",
      );
    }

    // Step 5: Calculate the new balance.
    const newQuantity = currentInventory.quantity_on_hand + quantityDelta;

    if (newQuantity < 0) {
      throw new AppError(
        409,
        "INSUFFICIENT_STOCK",
        `Insufficient stock. Available quantity: ${currentInventory.quantity_on_hand}.`,
      );
    }

    if (newQuantity > MAX_POSTGRES_INTEGER) {
      throw new AppError(
        422,
        "STOCK_QUANTITY_LIMIT_EXCEEDED",
        "Stock quantity exceeds the maximum supported value.",
      );
    }

    // Step 6: Update the inventory balance.
    const updatedBalance = await updateInventoryQuantity(
      client,
      currentInventory.id,
      newQuantity,
    );

    if (!updatedBalance) {
      throw new AppError(
        404,
        "INVENTORY_NOT_FOUND",
        "Inventory record not found.",
      );
    }

    // Step 7: Insert the append-only stock movement.
    const movementId = await insertStockMovement(client, {
      warehouseId,
      productId,
      performedBy,
      orderId: null,
      movementType,
      quantityDelta,
      reason: reason ?? null,
    });

    // Step 8: Retrieve updated inventory and movement details.
    const inventoryRecord = await findInventoryByIdWithClient(
      client,
      updatedBalance.id,
    );

    const movementRecord = await findStockMovementByIdWithClient(
      client,
      movementId,
    );

    if (!inventoryRecord || !movementRecord) {
      throw new Error("Failed to retrieve the updated inventory operation.");
    }

    // Step 9: Commit both changes together.
    await client.query("COMMIT");

    return {
      inventory: toPublicInventory(inventoryRecord),
      movement: toPublicStockMovement(movementRecord),
    };
  } catch (error: unknown) {
    // Roll back both balance and movement if any operation fails.
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error if rollback also fails.
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Receive stock.
 * Quantity must be positive.
 */
export async function receiveStock(
  input: StockOperationInput,
  performedBy: string,
): Promise<InventoryOperationResult> {
  return executeStockMovement(
    "RECEIPT",
    input.warehouseId,
    input.productId,
    performedBy,
    input.quantity,
    input.reason,
  );
}

/**
 * Issue stock.
 * The request quantity is positive,
 * while the recorded movement delta is negative.
 */
export async function issueStock(
  input: StockOperationInput,
  performedBy: string,
): Promise<InventoryOperationResult> {
  return executeStockMovement(
    "ISSUE",
    input.warehouseId,
    input.productId,
    performedBy,
    -input.quantity,
    input.reason,
  );
}

/**
 * Adjust stock using a signed quantity delta.
 */
export async function adjustStock(
  input: StockAdjustmentInput,
  performedBy: string,
): Promise<InventoryOperationResult> {
  return executeStockMovement(
    "ADJUSTMENT",
    input.warehouseId,
    input.productId,
    performedBy,
    input.quantityDelta,
    input.reason,
  );
}

/**
 * Update the reorder level without changing physical stock.
 */
export async function updateReorderLevel(
  id: string,
  reorderLevel: number,
): Promise<PublicInventory> {
  const updated = await updateInventoryReorderLevel(id, reorderLevel);

  if (!updated) {
    throw new AppError(
      404,
      "INVENTORY_NOT_FOUND",
      "Inventory record not found.",
    );
  }

  const inventory = await findInventoryById(updated.id);

  if (!inventory) {
    throw new AppError(
      404,
      "INVENTORY_NOT_FOUND",
      "Inventory record not found.",
    );
  }

  return toPublicInventory(inventory);
}
