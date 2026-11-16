export type OrderStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface OrderItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface Order {
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
  orderedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  totalAmount: string;
  items?: OrderItem[];
}

export interface OrderListData {
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrderItemPayload {
  productId: string;
  quantity: number;
}

export interface CreateOrderPayload {
  customerId: string;
  warehouseId: string;
  items: OrderItemPayload[];
}

export interface UpdateOrderPayload {
  customerId?: string;
  warehouseId?: string;
  items?: OrderItemPayload[];
}

export interface OrderQueryParams {
  customerId?: string;
  warehouseId?: string;
  status?: OrderStatus;
  limit: number;
  offset: number;
}
