import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { ApiError } from "../../lib/api";
import { server } from "../../test/mocks/server";
import {
  getDashboardData,
  type DashboardInventoryItem,
  type DashboardOrder,
} from "./dashboard.api";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");
const API_PATH = new URL(API_URL).pathname.replace(/\/+$/, "");

const TOKEN = "dashboard-test-access-token";

const inventoryItem: DashboardInventoryItem = {
  id: "inventory-001",
  productId: "product-001",
  productSku: "WM-001",
  productName: "Wireless Mouse",
  warehouseName: "Surabaya Distribution Center",
  quantityOnHand: 5,
  reorderLevel: 10,
  isLowStock: true,
};

const recentOrder: DashboardOrder = {
  id: "order-001",
  orderNumber: "SO-2026-0001",
  customerName: "Acme Corporation",
  warehouseName: "Surabaya Distribution Center",
  status: "CONFIRMED",
  orderedAt: "2026-01-15T00:00:00.000Z",
  itemCount: 2,
  totalAmount: "1250000.00",
};

const success = <T>(data: T) => ({
  status: "success" as const,
  data,
});

describe("Dashboard API", () => {
  it("fetches all dashboard resources and aggregates their responses", async () => {
    const observedRequests: Array<{
      path: string;
      authorization: string | null;
    }> = [];

    const observeRequest = (request: Request) => {
      const url = new URL(request.url);

      observedRequests.push({
        path: `${url.pathname}${url.search}`,
        authorization: request.headers.get("Authorization"),
      });
    };

    server.use(
      http.get(`${API_URL}/products`, ({ request }) => {
        observeRequest(request);

        const url = new URL(request.url);

        expect(url.searchParams.get("limit")).toBe("1");

        return HttpResponse.json(
          success({
            products: [{ id: "product-001" }],
            total: 42,
            limit: 1,
            offset: 0,
          }),
        );
      }),

      http.get(`${API_URL}/warehouses`, ({ request }) => {
        observeRequest(request);

        const url = new URL(request.url);

        expect(url.searchParams.get("limit")).toBe("1");

        return HttpResponse.json(
          success({
            warehouses: [{ id: "warehouse-001" }],
            total: 3,
            limit: 1,
            offset: 0,
          }),
        );
      }),

      http.get(`${API_URL}/inventory`, ({ request }) => {
        observeRequest(request);

        const url = new URL(request.url);

        expect(url.searchParams.get("lowStock")).toBe("true");
        expect(url.searchParams.get("limit")).toBe("5");

        return HttpResponse.json(
          success({
            inventory: [inventoryItem],
            total: 7,
            limit: 5,
            offset: 0,
          }),
        );
      }),

      http.get(`${API_URL}/orders`, ({ request }) => {
        observeRequest(request);

        const url = new URL(request.url);
        const isDraftQuery = url.searchParams.get("status") === "DRAFT";

        expect(url.searchParams.get("limit")).toBe(isDraftQuery ? "1" : "5");

        return HttpResponse.json(
          success({
            orders: isDraftQuery ? [] : [recentOrder],
            total: isDraftQuery ? 4 : 5,
            limit: isDraftQuery ? 1 : 5,
            offset: 0,
          }),
        );
      }),
    );

    const result = await getDashboardData(TOKEN);

    expect(observedRequests).toHaveLength(5);

    expect(observedRequests.map((request) => request.path).sort()).toEqual(
      [
        `${API_PATH}/products?limit=1`,
        `${API_PATH}/warehouses?limit=1`,
        `${API_PATH}/inventory?lowStock=true&limit=5`,
        `${API_PATH}/orders?status=DRAFT&limit=1`,
        `${API_PATH}/orders?limit=5`,
      ].sort(),
    );

    expect(
      observedRequests.every(
        (request) => request.authorization === `Bearer ${TOKEN}`,
      ),
    ).toBe(true);

    expect(result).toEqual({
      totalProducts: 42,
      totalWarehouses: 3,
      lowStockTotal: 7,
      draftOrderTotal: 4,
      lowStockItems: [inventoryItem],
      recentOrders: [recentOrder],
    });
  });

  it("rejects when one dashboard resource returns an API error", async () => {
    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json(
          success({
            products: [],
            total: 0,
            limit: 1,
            offset: 0,
          }),
        ),
      ),

      http.get(`${API_URL}/warehouses`, () =>
        HttpResponse.json(
          success({
            warehouses: [],
            total: 0,
            limit: 1,
            offset: 0,
          }),
        ),
      ),

      http.get(`${API_URL}/inventory`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "INVENTORY_UNAVAILABLE",
            message: "Inventory service is temporarily unavailable.",
          },
          { status: 503 },
        ),
      ),

      http.get(`${API_URL}/orders`, ({ request }) => {
        const url = new URL(request.url);
        const isDraftQuery = url.searchParams.has("status");

        return HttpResponse.json(
          success({
            orders: [],
            total: 0,
            limit: isDraftQuery ? 1 : 5,
            offset: 0,
          }),
        );
      }),
    );

    let caughtError: unknown;

    try {
      await getDashboardData(TOKEN);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);

    expect(caughtError).toMatchObject({
      status: 503,
      code: "INVENTORY_UNAVAILABLE",
      message: "Inventory service is temporarily unavailable.",
    });
  });
});
