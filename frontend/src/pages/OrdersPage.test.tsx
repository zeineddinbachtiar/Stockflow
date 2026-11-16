import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import OrdersPage from "./OrdersPage";
import { AuthProvider } from "../context/AuthContext";
import { server } from "../test/mocks/server";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");
const SESSION_KEY = "stockflow.auth.session";
const baseOrder = {
  id: "11",
  orderNumber: "SO-001",
  customerId: "1",
  customerCode: "CUST-001",
  customerName: "Maju",
  warehouseId: "2",
  warehouseCode: "WH-001",
  warehouseName: "Main",
  createdBy: "user-1",
  createdByName: "Sales",
  status: "DRAFT" as const,
  orderedAt: "2026-01-01T00:00:00.000Z",
  confirmedAt: null,
  cancelledAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  itemCount: 1,
  totalAmount: "10000",
  items: [
    {
      id: "21",
      productId: "3",
      productSku: "SKU-001",
      productName: "Widget",
      quantity: 1,
      unitPrice: "10000",
      lineTotal: "10000",
    },
  ],
};

function renderPage(
  role: "ADMIN" | "SALES_STAFF" | "WAREHOUSE_STAFF" = "ADMIN",
) {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: "token",
      refreshToken: "refresh",
      expiresAt: Date.now() + 900000,
      user: {
        id: role === "SALES_STAFF" ? "user-1" : "admin-1",
        fullName: role,
        email: `${role}@test.local`,
        role,
        isActive: true,
        createdAt: "2026-01-01",
      },
    }),
  );
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrdersPage />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function installHandlers() {
  server.use(
    http.get(`${API_URL}/orders`, () =>
      HttpResponse.json({
        status: "success",
        data: { orders: [baseOrder], total: 1, limit: 10, offset: 0 },
      }),
    ),
    http.get(`${API_URL}/orders/11`, () =>
      HttpResponse.json({ status: "success", data: { order: baseOrder } }),
    ),
    http.get(`${API_URL}/warehouses`, () =>
      HttpResponse.json({
        status: "success",
        data: {
          warehouses: [
            {
              id: "2",
              code: "WH-001",
              name: "Main",
              address: null,
              isActive: true,
              createdAt: "2026-01-01",
              updatedAt: "2026-01-01",
            },
          ],
          total: 1,
          limit: 100,
          offset: 0,
        },
      }),
    ),
    http.get(`${API_URL}/customers`, () =>
      HttpResponse.json({
        status: "success",
        data: {
          customers: [
            {
              id: "1",
              customerCode: "CUST-001",
              name: "Maju",
              email: null,
              phone: null,
              address: null,
              createdAt: "2026-01-01",
              updatedAt: "2026-01-01",
            },
          ],
          total: 1,
          limit: 100,
          offset: 0,
        },
      }),
    ),
    http.get(`${API_URL}/products`, () =>
      HttpResponse.json({
        status: "success",
        data: {
          products: [
            {
              id: "3",
              categoryId: "4",
              sku: "SKU-001",
              name: "Widget",
              description: null,
              unitPrice: "10000",
              isActive: true,
              createdAt: "2026-01-01",
              updatedAt: "2026-01-01",
            },
          ],
          total: 1,
          limit: 100,
          offset: 0,
        },
      }),
    ),
  );
}

describe("OrdersPage", () => {
  beforeEach(() => sessionStorage.clear());

  it("shows order list and detail items", async () => {
    installHandlers();
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("SO-001")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View" }));
    expect(
      await screen.findByRole("heading", { name: "Order Detail" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
  });

  it("allows warehouse staff to confirm but not edit draft orders", async () => {
    installHandlers();
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/orders/11/confirm`, () =>
        HttpResponse.json({
          status: "success",
          data: { order: { ...baseOrder, status: "CONFIRMED" } },
        }),
      ),
    );
    renderPage("WAREHOUSE_STAFF");
    await screen.findByText("SO-001");
    await user.click(screen.getByRole("button", { name: "View" }));
    expect(
      await screen.findByRole("button", { name: "Confirm Order" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Draft" }),
    ).not.toBeInTheDocument();
  });
});
