export type OrderStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface OrderRecord {
  id: string;
  order_number: string;
  customer_id: string;
  customer_code: string;
  customer_name: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  created_by: string;
  created_by_name: string;
  status: OrderStatus;
  ordered_at: Date;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
  item_count: number;
  total_amount: string;
}

export interface OrderItemRecord {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface OrderForUpdate {
  id: string;
  order_number: string;
  customer_id: string;
  warehouse_id: string;
  created_by: string;
  status: OrderStatus;
}

export interface OrderItemForUpdate {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
}

export interface PublicOrderItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface PublicOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  createdBy: string;
  createdByName: string;
  status: OrderStatus;
  orderedAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  totalAmount: string;
  items?: PublicOrderItem[];
}

export interface OrderQuery {
  customerId?: string;
  warehouseId?: string;
  status?: OrderStatus;
  limit: number;
  offset: number;
}

export interface RepositoryOrderQuery extends OrderQuery {
  createdBy?: string;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerId: string;
  warehouseId: string;
  items: CreateOrderItemInput[];
}

export interface UpdateOrderInput {
  customerId?: string;
  warehouseId?: string;
  items?: CreateOrderItemInput[];
}

export interface OrderListResult {
  orders: OrderRecord[];
  total: number;
}
