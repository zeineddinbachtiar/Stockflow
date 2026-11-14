import { apiRequest } from "../../lib/api";
import type { ApiEnvelope } from "../../types/auth.types";

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

interface ProductListData extends PaginationMeta {
  products: Array<{ id: string }>;
}

interface WarehouseListData extends PaginationMeta {
  warehouses: Array<{ id: string }>;
}

export interface DashboardInventoryItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  warehouseName: string;
  quantityOnHand: number;
  reorderLevel: number;
  isLowStock: boolean;
}

interface InventoryListData extends PaginationMeta {
  inventory: DashboardInventoryItem[];
}

export type DashboardOrderStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface DashboardOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  warehouseName: string;
  status: DashboardOrderStatus;
  orderedAt: string;
  itemCount: number;
  totalAmount: string;
}

interface OrderListData extends PaginationMeta {
  orders: DashboardOrder[];
}

export interface DashboardData {
  totalProducts: number;
  totalWarehouses: number;
  lowStockTotal: number;
  draftOrderTotal: number;
  lowStockItems: DashboardInventoryItem[];
  recentOrders: DashboardOrder[];
}

/**
 * Fetch dashboard information from existing StockFlow API endpoints.
 */
export async function getDashboardData(
  accessToken: string,
): Promise<DashboardData> {
  const [
    productsResponse,
    warehousesResponse,
    lowStockResponse,
    draftOrdersResponse,
    recentOrdersResponse,
  ] = await Promise.all([
    apiRequest<ApiEnvelope<ProductListData>>(
      "/products?limit=1",
      {},
      accessToken,
    ),

    apiRequest<ApiEnvelope<WarehouseListData>>(
      "/warehouses?limit=1",
      {},
      accessToken,
    ),

    apiRequest<ApiEnvelope<InventoryListData>>(
      "/inventory?lowStock=true&limit=5",
      {},
      accessToken,
    ),

    apiRequest<ApiEnvelope<OrderListData>>(
      "/orders?status=DRAFT&limit=1",
      {},
      accessToken,
    ),

    apiRequest<ApiEnvelope<OrderListData>>("/orders?limit=5", {}, accessToken),
  ]);

  return {
    totalProducts: productsResponse.data.total,
    totalWarehouses: warehousesResponse.data.total,
    lowStockTotal: lowStockResponse.data.total,
    draftOrderTotal: draftOrdersResponse.data.total,
    lowStockItems: lowStockResponse.data.inventory,
    recentOrders: recentOrdersResponse.data.orders,
  };
}
