import type { PoolClient } from "pg";

import { pool } from "../config/database";

import type {
  OrderForUpdate,
  OrderItemForUpdate,
  OrderItemRecord,
  OrderRecord,
  RepositoryOrderQuery,
} from "../types/order.types";

const ORDER_SELECT = `
  SELECT
    o.id,
    o.order_number,
    o.customer_id,
    c.customer_code,
    c.name AS customer_name,
    o.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    o.created_by,
    u.full_name AS created_by_name,
    o.status,
    o.ordered_at,
    o.confirmed_at,
    o.cancelled_at,
    o.created_at,
    o.updated_at,
    COALESCE(t.item_count, 0)::integer AS item_count,
    COALESCE(t.total_amount, 0)::numeric::text AS total_amount
  FROM orders o
  INNER JOIN customers c ON c.id = o.customer_id
  INNER JOIN warehouses w ON w.id = o.warehouse_id
  INNER JOIN users u ON u.id = o.created_by
  LEFT JOIN (
    SELECT
      order_id,
      COUNT(*)::integer AS item_count,
      SUM(quantity * unit_price) AS total_amount
    FROM order_items
    GROUP BY order_id
  ) t ON t.order_id = o.id
`;

export async function findAllOrders(
  query: RepositoryOrderQuery,
): Promise<{ orders: OrderRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  const addCondition = (sql: string, value: string): void => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };

  if (query.customerId) {
    addCondition("o.customer_id = ?", query.customerId);
  }

  if (query.warehouseId) {
    addCondition("o.warehouse_id = ?", query.warehouseId);
  }

  if (query.status) {
    addCondition("o.status = ?", query.status);
  }

  if (query.createdBy) {
    addCondition("o.created_by = ?", query.createdBy);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM orders o
      ${whereClause}
    `,
    values,
  );

  const dataValues = [...values];
  const limitPosition = dataValues.length + 1;
  const offsetPosition = dataValues.length + 2;

  dataValues.push(query.limit, query.offset);

  const result = await pool.query<OrderRecord>(
    `
      ${ORDER_SELECT}
      ${whereClause}
      ORDER BY o.ordered_at DESC, o.id DESC
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
    `,
    dataValues,
  );

  return {
    orders: result.rows,
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function findOrderById(orderId: string): Promise<{
  order: OrderRecord;
  items: OrderItemRecord[];
} | null> {
  const orderResult = await pool.query<OrderRecord>(
    `
      ${ORDER_SELECT}
      WHERE o.id = $1
    `,
    [orderId],
  );

  const order = orderResult.rows[0];

  if (!order) {
    return null;
  }

  const itemResult = await pool.query<OrderItemRecord>(
    `
      SELECT
        oi.id,
        oi.product_id,
        p.sku AS product_sku,
        p.name AS product_name,
        oi.quantity,
        oi.unit_price::text AS unit_price,
        (oi.quantity * oi.unit_price)::numeric::text AS line_total
      FROM order_items oi
      INNER JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC
    `,
    [orderId],
  );

  return {
    order,
    items: itemResult.rows,
  };
}

export async function findOrderForUpdate(
  client: PoolClient,
  orderId: string,
): Promise<OrderForUpdate | null> {
  const result = await client.query<OrderForUpdate>(
    `
      SELECT
        id,
        order_number,
        customer_id,
        warehouse_id,
        created_by,
        status
      FROM orders
      WHERE id = $1
      FOR UPDATE
    `,
    [orderId],
  );

  return result.rows[0] ?? null;
}

export async function findOrderItemsForUpdate(
  client: PoolClient,
  orderId: string,
): Promise<OrderItemForUpdate[]> {
  const result = await client.query<OrderItemForUpdate>(
    `
      SELECT
        id,
        product_id,
        quantity,
        unit_price::text AS unit_price
      FROM order_items
      WHERE order_id = $1
      ORDER BY product_id ASC
      FOR UPDATE
    `,
    [orderId],
  );

  return result.rows;
}

export async function lockCustomer(
  client: PoolClient,
  customerId: string,
): Promise<boolean> {
  const result = await client.query(
    `
      SELECT id
      FROM customers
      WHERE id = $1
      FOR SHARE
    `,
    [customerId],
  );

  return result.rowCount === 1;
}

export async function lockActiveWarehouse(
  client: PoolClient,
  warehouseId: string,
): Promise<boolean> {
  const result = await client.query(
    `
      SELECT id
      FROM warehouses
      WHERE id = $1
        AND is_active = TRUE
      FOR SHARE
    `,
    [warehouseId],
  );

  return result.rowCount === 1;
}

export interface ActiveProductPrice {
  id: string;
  unit_price: string;
}

export async function lockActiveProducts(
  client: PoolClient,
  productIds: string[],
): Promise<ActiveProductPrice[]> {
  const result = await client.query<ActiveProductPrice>(
    `
      SELECT
        id,
        unit_price::text AS unit_price
      FROM products
      WHERE id = ANY($1::bigint[])
        AND is_active = TRUE
      ORDER BY id ASC
      FOR SHARE
    `,
    [productIds],
  );

  return result.rows;
}

export async function lockWarehouseRegardlessOfStatus(
  client: PoolClient,
  warehouseId: string,
): Promise<boolean> {
  const result = await client.query(
    `
      SELECT id
      FROM warehouses
      WHERE id = $1
      FOR SHARE
    `,
    [warehouseId],
  );

  return result.rowCount === 1;
}

export async function lockProductsRegardlessOfStatus(
  client: PoolClient,
  productIds: string[],
): Promise<boolean> {
  const result = await client.query(
    `
      SELECT id
      FROM products
      WHERE id = ANY($1::bigint[])
      ORDER BY id ASC
      FOR SHARE
    `,
    [productIds],
  );

  return result.rowCount === productIds.length;
}

export async function insertOrder(
  client: PoolClient,
  input: {
    orderNumber: string;
    customerId: string;
    warehouseId: string;
    createdBy: string;
  },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO orders (
        order_number,
        customer_id,
        warehouse_id,
        created_by,
        status
      )
      VALUES ($1, $2, $3, $4, 'DRAFT')
      RETURNING id
    `,
    [input.orderNumber, input.customerId, input.warehouseId, input.createdBy],
  );

  const id = result.rows[0]?.id;

  if (!id) {
    throw new Error("ORDER_CREATE_FAILED");
  }

  return id;
}

export async function insertOrderItem(
  client: PoolClient,
  input: {
    orderId: string;
    productId: string;
    quantity: number;
    unitPrice: string;
  },
): Promise<void> {
  await client.query(
    `
      INSERT INTO order_items (
        order_id,
        product_id,
        quantity,
        unit_price
      )
      VALUES ($1, $2, $3, $4)
    `,
    [input.orderId, input.productId, input.quantity, input.unitPrice],
  );
}

export async function deleteOrderItems(
  client: PoolClient,
  orderId: string,
): Promise<void> {
  await client.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
}

export async function updateDraftOrder(
  client: PoolClient,
  input: {
    orderId: string;
    customerId: string;
    warehouseId: string;
  },
): Promise<void> {
  await client.query(
    `
      UPDATE orders
      SET
        customer_id = $2,
        warehouse_id = $3
      WHERE id = $1
        AND status = 'DRAFT'
    `,
    [input.orderId, input.customerId, input.warehouseId],
  );
}

export async function markOrderConfirmed(
  client: PoolClient,
  orderId: string,
): Promise<void> {
  await client.query(
    `
      UPDATE orders
      SET
        status = 'CONFIRMED',
        confirmed_at = NOW()
      WHERE id = $1
        AND status = 'DRAFT'
    `,
    [orderId],
  );
}

export async function markOrderCancelled(
  client: PoolClient,
  orderId: string,
): Promise<void> {
  await client.query(
    `
      UPDATE orders
      SET
        status = 'CANCELLED',
        cancelled_at = NOW()
      WHERE id = $1
        AND status IN ('DRAFT', 'CONFIRMED')
    `,
    [orderId],
  );
}

export async function ensureOrderInventoryRow(
  client: PoolClient,
  warehouseId: string,
  productId: string,
): Promise<void> {
  await client.query(
    `
      INSERT INTO inventory (
        warehouse_id,
        product_id,
        quantity_on_hand,
        reorder_level
      )
      VALUES ($1, $2, 0, 0)
      ON CONFLICT (warehouse_id, product_id) DO NOTHING
    `,
    [warehouseId, productId],
  );
}

export interface LockedInventoryBalance {
  id: string;
  quantity_on_hand: number;
}

export async function lockOrderInventoryBalance(
  client: PoolClient,
  warehouseId: string,
  productId: string,
): Promise<LockedInventoryBalance | null> {
  const result = await client.query<LockedInventoryBalance>(
    `
      SELECT id, quantity_on_hand
      FROM inventory
      WHERE warehouse_id = $1
        AND product_id = $2
      FOR UPDATE
    `,
    [warehouseId, productId],
  );

  return result.rows[0] ?? null;
}

export async function updateOrderInventoryQuantity(
  client: PoolClient,
  inventoryId: string,
  quantity: number,
): Promise<void> {
  await client.query(
    `
      UPDATE inventory
      SET quantity_on_hand = $2
      WHERE id = $1
    `,
    [inventoryId, quantity],
  );
}

export async function insertOrderStockMovement(
  client: PoolClient,
  input: {
    warehouseId: string;
    productId: string;
    performedBy: string;
    orderId: string;
    movementType: "ORDER_CONFIRM" | "ORDER_CANCEL";
    quantityDelta: number;
    reason: string;
  },
): Promise<void> {
  await client.query(
    `
      INSERT INTO stock_movements (
        warehouse_id,
        product_id,
        performed_by,
        order_id,
        movement_type,
        quantity_delta,
        reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.warehouseId,
      input.productId,
      input.performedBy,
      input.orderId,
      input.movementType,
      input.quantityDelta,
      input.reason,
    ],
  );
}
