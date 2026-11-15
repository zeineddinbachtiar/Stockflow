import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import type { DashboardData } from "../features/dashboard/dashboard.api";
import DashboardPage from "./DashboardPage";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const inventoryItem = {
  id: "inventory-001",
  productId: "product-001",
  productSku: "WM-001",
  productName: "Wireless Mouse",
  warehouseName: "Surabaya Distribution Center",
  quantityOnHand: 5,
  reorderLevel: 10,
  isLowStock: true,
};

const secondInventoryItem = {
  id: "inventory-002",
  productId: "product-002",
  productSku: "HUB-002",
  productName: "USB-C Hub",
  warehouseName: "Jakarta Central Warehouse",
  quantityOnHand: 2,
  reorderLevel: 5,
  isLowStock: true,
};

const recentOrders = [
  {
    id: "order-001",
    orderNumber: "SO-2026-0001",
    customerName: "Acme Corporation",
    warehouseName: "Surabaya Distribution Center",
    status: "DRAFT" as const,
    orderedAt: "2026-01-15T00:00:00.000Z",
    itemCount: 2,
    totalAmount: "1250000.00",
  },
  {
    id: "order-002",
    orderNumber: "SO-2026-0002",
    customerName: "Beta Trading",
    warehouseName: "Jakarta Central Warehouse",
    status: "CONFIRMED" as const,
    orderedAt: "2026-01-16T00:00:00.000Z",
    itemCount: 3,
    totalAmount: "2500000.00",
  },
  {
    id: "order-003",
    orderNumber: "SO-2026-0003",
    customerName: "Gamma Supplies",
    warehouseName: "Surabaya Distribution Center",
    status: "CANCELLED" as const,
    orderedAt: "2026-01-17T00:00:00.000Z",
    itemCount: 1,
    totalAmount: "890000.00",
  },
];

const defaultData: DashboardData = {
  totalProducts: 42,
  totalWarehouses: 3,
  lowStockTotal: 7,
  draftOrderTotal: 4,
  lowStockItems: [inventoryItem, secondInventoryItem],
  recentOrders,
};

const success = <T,>(data: T) => ({
  status: "success" as const,
  data,
});

interface DashboardHandlerOptions {
  data?: Partial<DashboardData>;
  failFirstInventory?: boolean;
}

function installDashboardHandlers(options: DashboardHandlerOptions = {}) {
  const data: DashboardData = {
    ...defaultData,
    ...options.data,
  };

  const requests = {
    products: 0,
    warehouses: 0,
    inventory: 0,
    orders: 0,
  };

  server.use(
    http.get(`${API_URL}/products`, () => {
      requests.products += 1;

      return HttpResponse.json(
        success({
          products: [{ id: "product-001" }],
          total: data.totalProducts,
          limit: 1,
          offset: 0,
        }),
      );
    }),

    http.get(`${API_URL}/warehouses`, () => {
      requests.warehouses += 1;

      return HttpResponse.json(
        success({
          warehouses: [{ id: "warehouse-001" }],
          total: data.totalWarehouses,
          limit: 1,
          offset: 0,
        }),
      );
    }),

    http.get(`${API_URL}/inventory`, () => {
      requests.inventory += 1;

      if (options.failFirstInventory && requests.inventory === 1) {
        return HttpResponse.json(
          {
            status: "error",
            code: "INVENTORY_UNAVAILABLE",
            message: "Inventory service is temporarily unavailable.",
          },
          { status: 503 },
        );
      }

      return HttpResponse.json(
        success({
          inventory: data.lowStockItems.slice(0, 5),
          total: data.lowStockTotal,
          limit: 5,
          offset: 0,
        }),
      );
    }),

    http.get(`${API_URL}/orders`, ({ request }) => {
      requests.orders += 1;

      const url = new URL(request.url);
      const isDraftQuery = url.searchParams.get("status") === "DRAFT";

      return HttpResponse.json(
        success({
          orders: isDraftQuery
            ? data.recentOrders
                .filter((order) => order.status === "DRAFT")
                .slice(0, 1)
            : data.recentOrders.slice(0, 5),
          total: isDraftQuery ? data.draftOrderTotal : data.recentOrders.length,
          limit: isDraftQuery ? 1 : 5,
          offset: 0,
        }),
      );
    }),
  );

  return requests;
}

function renderDashboard() {
  return renderWithProviders(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  it("displays summary metrics, low-stock records, and recent orders", async () => {
    const user = userEvent.setup();
    const requests = installDashboardHandlers();

    renderDashboard();

    expect(await screen.findByText("Wireless Mouse")).toBeInTheDocument();

    expect(
      screen.getByText("Active Products").closest("article"),
    ).toHaveTextContent("42");

    expect(
      screen.getByText("Active Warehouses").closest("article"),
    ).toHaveTextContent("3");

    expect(
      screen.getByText("Low Stock Records").closest("article"),
    ).toHaveTextContent("7");

    expect(
      screen.getByText("Draft Orders").closest("article"),
    ).toHaveTextContent("4");

    expect(screen.getByText("WM-001")).toBeInTheDocument();

    expect(
      screen.getByText("Surabaya Distribution Center"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Showing 2 of 7 low-stock records."),
    ).toBeInTheDocument();

    expect(screen.getByText("SO-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
    expect(screen.getByText("CONFIRMED")).toBeInTheDocument();
    expect(screen.getByText("CANCELLED")).toBeInTheDocument();

    expect(screen.getByText("1.250.000,00")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /View inventory/ }),
    ).toHaveAttribute("href", "/inventory");

    expect(screen.getByRole("link", { name: /View orders/ })).toHaveAttribute(
      "href",
      "/orders",
    );

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(requests.products).toBe(2);
    });
  });

  it("displays empty states when no low-stock records or orders exist", async () => {
    installDashboardHandlers({
      data: {
        totalProducts: 0,
        totalWarehouses: 0,
        lowStockTotal: 0,
        draftOrderTotal: 0,
        lowStockItems: [],
        recentOrders: [],
      },
    });

    renderDashboard();

    expect(await screen.findByText("No low-stock records")).toBeInTheDocument();

    expect(screen.getByText("No orders yet")).toBeInTheDocument();
  });

  it("allows retry after dashboard data request fails", async () => {
    const user = userEvent.setup();

    const requests = installDashboardHandlers({
      failFirstInventory: true,
    });

    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Inventory service is temporarily unavailable.",
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Wireless Mouse")).toBeInTheDocument();

    expect(requests.inventory).toBe(2);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
