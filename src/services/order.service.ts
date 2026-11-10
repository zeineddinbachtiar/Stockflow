
import { randomUUID } from "node:crypto";

import { pool } from "../config/database";

import type { UserRole } from "../types/user.types";

import type {
  CreateOrderInput,
  OrderItemRecord,
  OrderQuery,
  OrderRecord,
  PublicOrder,
  PublicOrderItem,
  RepositoryOrderQuery,
  UpdateOrderInput
} from "../types/order.types";

import {
  deleteOrderItems,
  ensureOrderInventoryRow,
  findAllOrders,
  findOrderById,
  findOrderForUpdate,
  findOrderItemsForUpdate,
  insertOrder,
  insertOrderItem,
  insertOrderStockMovement,
  lockActiveProducts,
  lockActiveWarehouse,
  lockCustomer,
  lockOrderInventoryBalance,
  lockProductsRegardlessOfStatus,
  lockWarehouseRegardlessOfStatus,
  markOrderCancelled,
  markOrderConfirmed,
  updateDraftOrder,
  updateOrderInventoryQuantity
} from "../repositories/order.repositories";

const MAX_INTEGER = 2147483647;

type OrderActor = {
  id: string;
  role: UserRole;
};

function createError(code: string): Error {
  return new Error(code);
}

function sortByProductId<T extends { product_id?: string; productId?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aId = BigInt(a.product_id ?? a.productId ?? "0");
    const bId = BigInt(b.product_id ?? b.productId ?? "0");

    if (aId < bId) return -1;
    if (aId > bId) return 1;
    return 0;
  });
}

function toPublicOrderItem(item: OrderItemRecord): PublicOrderItem {
  return {
    id: item.id,
    productId: item.product_id,
    productSku: item.product_sku,
    productName: item.product_name,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    lineTotal: item.line_total
  };
}

function toPublicOrder(
  order: OrderRecord,
  items?: OrderItemRecord[]
): PublicOrder {
  return {
    id: order.id,
    orderNumber: order.order_number,
    customerId: order.customer_id,
    customerCode: order.customer_code,
    customerName: order.customer_name,
    warehouseId: order.warehouse_id,
    warehouseCode: order.warehouse_code,
    warehouseName: order.warehouse_name,
    createdBy: order.created_by,
    createdByName: order.created_by_name,
    status: order.status,
    orderedAt: order.ordered_at,
    confirmedAt: order.confirmed_at,
    cancelledAt: order.cancelled_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    itemCount: order.item_count,
    totalAmount: order.total_amount,
    ...(items !== undefined
      ? { items: items.map(toPublicOrderItem) }
      : {})
  };
}

function assertCanManageDraft(
  order: { created_by: string },
  actor: OrderActor
): void {
  if (actor.role === "ADMIN") {
    return;
  }

  if (
    actor.role === "SALES_STAFF" &&
    order.created_by === actor.id
  ) {
    return;
  }

  throw createError("ORDER_ACCESS_DENIED");
}

function assertCanProcessConfirmedOrder(actor: OrderActor): void {
  if (
    actor.role !== "ADMIN" &&
    actor.role !== "WAREHOUSE_STAFF"
  ) {
    throw createError("ORDER_ACCESS_DENIED");
  }
}

function assertCanCreateOrder(actor: OrderActor): void {
  if (
    actor.role !== "ADMIN" &&
    actor.role !== "SALES_STAFF"
  ) {
    throw createError("ORDER_ACCESS_DENIED");
  }
}

function assertSalesOrderOwnership(
  order: { created_by: string },
  actor: OrderActor
): void {
  if (
    actor.role === "SALES_STAFF" &&
    order.created_by !== actor.id
  ) {
    throw createError("ORDER_NOT_FOUND");
  }
}

export async function getAllOrders(
  query: OrderQuery,
  actor: OrderActor
): Promise<{
  orders: PublicOrder[];
  total: number;
  limit: number;
  offset: number;
}> {
  const repositoryQuery: RepositoryOrderQuery = {
    ...query
  };

  if (actor.role === "SALES_STAFF") {
    repositoryQuery.createdBy = actor.id;
  }

  const result = await findAllOrders(repositoryQuery);

  return {
    orders: result.orders.map((order) => toPublicOrder(order)),
    total: result.total,
    limit: query.limit,
    offset: query.offset
  };
}

export async function getOrderById(
  orderId: string,
  actor: OrderActor
): Promise<PublicOrder | null> {
  const result = await findOrderById(orderId);

  if (!result) {
    return null;
  }

  assertSalesOrderOwnership(result.order, actor);

  return toPublicOrder(result.order, result.items);
}

export async function createOrder(
  input: CreateOrderInput,
  actor: OrderActor
): Promise<PublicOrder> {
  assertCanCreateOrder(actor);

  const client = await pool.connect();

  let orderId: string | null = null;

  try {
    await client.query("BEGIN");

    const customerExists = await lockCustomer(
      client,
      input.customerId
    );

    if (!customerExists) {
      throw createError("CUSTOMER_NOT_FOUND");
    }

    const warehouseActive = await lockActiveWarehouse(
      client,
      input.warehouseId
    );

    if (!warehouseActive) {
      throw createError("WAREHOUSE_NOT_FOUND");
    }

    const sortedItems = sortByProductId(
      input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity
      }))
    );

    const productIds = sortedItems.map(
      (item) => item.productId
    );

    const products = await lockActiveProducts(
      client,
      productIds
    );

    if (products.length !== productIds.length) {
      throw createError("PRODUCT_NOT_FOUND_OR_INACTIVE");
    }

    const productPriceMap = new Map(
      products.map((product) => [
        product.id,
        product.unit_price
      ])
    );

    const orderNumber = `SO-${randomUUID()}`;

    orderId = await insertOrder(client, {
      orderNumber,
      customerId: input.customerId,
      warehouseId: input.warehouseId,
      createdBy: actor.id
    });

    for (const item of sortedItems) {
      const unitPrice = productPriceMap.get(item.productId);

      if (unitPrice === undefined) {
        throw createError("PRODUCT_NOT_FOUND_OR_INACTIVE");
      }

      await insertOrderItem(client, {
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice
      });
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const result = await findOrderById(orderId);

  if (!result) {
    throw createError("ORDER_CREATE_FAILED");
  }

  return toPublicOrder(result.order, result.items);
}

export async function updateOrder(
  orderId: string,
  input: UpdateOrderInput,
  actor: OrderActor
): Promise<PublicOrder> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const order = await findOrderForUpdate(client, orderId);

    if (!order) {
        throw createError("ORDER_NOT_FOUND");
    }

    // Check ownership before revealing order status.
    assertSalesOrderOwnership(order, actor);

    if (order.status !== "DRAFT") {
        throw createError("ORDER_NOT_DRAFT");
    }

    assertCanManageDraft(order, actor);

    const customerId = input.customerId ?? order.customer_id;
    const warehouseId = input.warehouseId ?? order.warehouse_id;

    const customerExists = await lockCustomer(
      client,
      customerId
    );

    if (!customerExists) {
      throw createError("CUSTOMER_NOT_FOUND");
    }

    const warehouseActive = await lockActiveWarehouse(
      client,
      warehouseId
    );

    if (!warehouseActive) {
      throw createError("WAREHOUSE_NOT_FOUND");
    }

    if (input.items !== undefined) {
      const sortedItems = sortByProductId(
        input.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      );

      const productIds = sortedItems.map(
        (item) => item.productId
      );

      const products = await lockActiveProducts(
        client,
        productIds
      );

      if (products.length !== productIds.length) {
        throw createError("PRODUCT_NOT_FOUND_OR_INACTIVE");
      }

      const productPriceMap = new Map(
        products.map((product) => [
          product.id,
          product.unit_price
        ])
      );

      await deleteOrderItems(client, orderId);

      for (const item of sortedItems) {
        const unitPrice = productPriceMap.get(item.productId);

        if (unitPrice === undefined) {
          throw createError("PRODUCT_NOT_FOUND_OR_INACTIVE");
        }

        await insertOrderItem(client, {
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice
        });
      }
    }

    await updateDraftOrder(client, {
      orderId,
      customerId,
      warehouseId
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const result = await findOrderById(orderId);

  if (!result) {
    throw createError("ORDER_NOT_FOUND");
  }

  return toPublicOrder(result.order, result.items);
}

export async function confirmOrder(
  orderId: string,
  actor: OrderActor
): Promise<PublicOrder> {
  assertCanProcessConfirmedOrder(actor);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const order = await findOrderForUpdate(client, orderId);

    if (!order) {
      throw createError("ORDER_NOT_FOUND");
    }

    if (order.status !== "DRAFT") {
      throw createError("ORDER_NOT_DRAFT");
    }

    const items = await findOrderItemsForUpdate(
      client,
      orderId
    );

    if (items.length === 0) {
      throw createError("ORDER_HAS_NO_ITEMS");
    }

    const warehouseActive = await lockActiveWarehouse(
      client,
      order.warehouse_id
    );

    if (!warehouseActive) {
      throw createError("WAREHOUSE_NOT_FOUND");
    }

    const sortedItems = sortByProductId(
      items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity
      }))
    );

    const productIds = sortedItems.map(
      (item) => item.product_id
    );

    const products = await lockActiveProducts(
      client,
      productIds
    );

    if (products.length !== productIds.length) {
        throw createError("ORDER_PRODUCT_INACTIVE");
    }

    // Ensure all inventory rows exist before locking balances.
    for (const item of sortedItems) {
      await ensureOrderInventoryRow(
        client,
        order.warehouse_id,
        item.product_id
      );
    }

    const balances = new Map<
      string,
      { id: string; quantity: number }
    >();

    // Lock in a consistent product ID order to reduce deadlock risk.
    for (const item of sortedItems) {
      const balance = await lockOrderInventoryBalance(
        client,
        order.warehouse_id,
        item.product_id
      );

      if (!balance) {
        throw createError("INVENTORY_NOT_FOUND");
      }

      balances.set(item.product_id, {
        id: balance.id,
        quantity: balance.quantity_on_hand
      });
    }

    // Verify every item before applying any stock update.
    for (const item of items) {
      const balance = balances.get(item.product_id);

      if (!balance) {
        throw createError("INVENTORY_NOT_FOUND");
      }

      if (balance.quantity < item.quantity) {
        throw createError("INSUFFICIENT_STOCK");
      }
    }

    // Update stock and append movement records in the same transaction.
    for (const item of items) {
      const balance = balances.get(item.product_id);

      if (!balance) {
        throw createError("INVENTORY_NOT_FOUND");
      }

      await updateOrderInventoryQuantity(
        client,
        balance.id,
        balance.quantity - item.quantity
      );

      await insertOrderStockMovement(client, {
        warehouseId: order.warehouse_id,
        productId: item.product_id,
        performedBy: actor.id,
        orderId,
        movementType: "ORDER_CONFIRM",
        quantityDelta: -item.quantity,
        reason: `Order ${order.order_number} confirmed`
      });
    }

    await markOrderConfirmed(client, orderId);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const result = await findOrderById(orderId);

  if (!result) {
    throw createError("ORDER_NOT_FOUND");
  }

  return toPublicOrder(result.order, result.items);
}

export async function cancelOrder(
  orderId: string,
  actor: OrderActor
): Promise<PublicOrder> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const order = await findOrderForUpdate(client, orderId);

    if (!order) {
        throw createError("ORDER_NOT_FOUND");
    }

        // Check ownership before revealing cancellation status.
        assertSalesOrderOwnership(order, actor);

    if (order.status === "CANCELLED") {
        throw createError("ORDER_ALREADY_CANCELLED");
    }

    if (order.status === "DRAFT") {
      assertCanManageDraft(order, actor);

      await markOrderCancelled(client, orderId);
      await client.query("COMMIT");
    } else if (order.status === "CONFIRMED") {
      assertCanProcessConfirmedOrder(actor);

      const items = await findOrderItemsForUpdate(
        client,
        orderId
      );

      const sortedItems = sortByProductId(
        items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        }))
      );

      // A confirmed order must be restorable even if its resources
      // have since been deactivated.
      const warehouseExists = await lockWarehouseRegardlessOfStatus(
        client,
        order.warehouse_id
      );

      if (!warehouseExists) {
        throw createError("ORDER_WAREHOUSE_NOT_FOUND");
      }

      const productIds = sortedItems.map(
        (item) => item.product_id
      );

      const productsExist = await lockProductsRegardlessOfStatus(
        client,
        productIds
      );

      if (!productsExist) {
        throw createError("ORDER_PRODUCT_NOT_FOUND");
      }

      for (const item of sortedItems) {
        await ensureOrderInventoryRow(
          client,
          order.warehouse_id,
          item.product_id
        );
      }

      const balances = new Map<
        string,
        { id: string; quantity: number }
      >();

      for (const item of sortedItems) {
        const balance = await lockOrderInventoryBalance(
          client,
          order.warehouse_id,
          item.product_id
        );

        if (!balance) {
          throw createError("INVENTORY_NOT_FOUND");
        }

        balances.set(item.product_id, {
          id: balance.id,
          quantity: balance.quantity_on_hand
        });
      }

      for (const item of items) {
        const balance = balances.get(item.product_id);

        if (!balance) {
          throw createError("INVENTORY_NOT_FOUND");
        }

        if (balance.quantity + item.quantity > MAX_INTEGER) {
          throw createError("STOCK_QUANTITY_LIMIT_EXCEEDED");
        }
      }

      for (const item of items) {
        const balance = balances.get(item.product_id);

        if (!balance) {
          throw createError("INVENTORY_NOT_FOUND");
        }

        await updateOrderInventoryQuantity(
          client,
          balance.id,
          balance.quantity + item.quantity
        );

        await insertOrderStockMovement(client, {
          warehouseId: order.warehouse_id,
          productId: item.product_id,
          performedBy: actor.id,
          orderId,
          movementType: "ORDER_CANCEL",
          quantityDelta: item.quantity,
          reason: `Order ${order.order_number} cancelled`
        });
      }

      await markOrderCancelled(client, orderId);

      await client.query("COMMIT");
    } else {
      throw createError("INVALID_ORDER_STATUS");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const result = await findOrderById(orderId);

  if (!result) {
    throw createError("ORDER_NOT_FOUND");
  }

  return toPublicOrder(result.order, result.items);
}
