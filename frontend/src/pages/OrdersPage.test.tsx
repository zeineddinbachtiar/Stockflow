import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

function pagedProducts() {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    id: String(index + 1),
    categoryId: "4",
    sku: `SKU-${String(index + 1).padStart(3, "0")}`,
    name: `Product ${index + 1}`,
    description: null,
    unitPrice: "10000",
    isActive: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  }));
  const finalProduct = {
    id: "101",
    categoryId: "4",
    sku: "SKU-101",
    name: "Product 101",
    description: null,
    unitPrice: "10000",
    isActive: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };

  return { firstPage, finalProduct };
}

describe("OrdersPage", () => {
  beforeEach(() => sessionStorage.clear());

  it("shows order list and detail items", async () => {
    installHandlers();
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("SO-001")).toBeInTheDocument();
    const ordersTable = screen.getByRole("table");
    expect(ordersTable.parentElement).toHaveClass(
      "overflow-x-auto",
      "overscroll-x-contain",
    );
    expect(ordersTable).toHaveClass("min-w-[1050px]");
    expect(ordersTable).toHaveClass("responsive-data-table");
    expect(
      ordersTable.querySelector('[data-label="Customer"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toHaveClass(
      "sticky",
    );
    await user.click(screen.getByRole("button", { name: "View" }));
    expect(
      await screen.findByRole("heading", { name: "Order Detail" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
  });

  it("loads and allows selecting order options beyond the first 100", async () => {
    installHandlers();
    const user = userEvent.setup();
    const { firstPage, finalProduct } = pagedProducts();
    const requestedOffsets: string[] = [];
    const customers = Array.from({ length: 100 }, (_, index) => ({
      id: `customer-${index + 1}`,
      customerCode: `CUST-${String(index + 1).padStart(3, "0")}`,
      name: `Customer ${index + 1}`,
      email: null,
      phone: null,
      address: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    }));
    const finalCustomer = {
      ...customers[0]!,
      id: "customer-101",
      customerCode: "CUST-101",
      name: "Customer 101",
    };
    const warehouses = Array.from({ length: 100 }, (_, index) => ({
      id: `warehouse-${index + 1}`,
      code: `WH-${String(index + 1).padStart(3, "0")}`,
      name: `Warehouse ${index + 1}`,
      address: null,
      isActive: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    }));
    const finalWarehouse = {
      ...warehouses[0]!,
      id: "warehouse-101",
      code: "WH-101",
      name: "Warehouse 101",
    };

    server.use(
      http.get(`${API_URL}/customers`, ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get("offset") ?? 0,
        );

        return HttpResponse.json({
          status: "success",
          data: {
            customers: offset === 0 ? customers : [finalCustomer],
            total: 101,
            limit: 100,
            offset,
          },
        });
      }),
      http.get(`${API_URL}/warehouses`, ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get("offset") ?? 0,
        );

        return HttpResponse.json({
          status: "success",
          data: {
            warehouses: offset === 0 ? warehouses : [finalWarehouse],
            total: 101,
            limit: 100,
            offset,
          },
        });
      }),
      http.get(`${API_URL}/products`, ({ request }) => {
        const url = new URL(request.url);
        const offset = url.searchParams.get("offset") ?? "0";
        requestedOffsets.push(offset);

        return HttpResponse.json({
          status: "success",
          data: {
            products: offset === "0" ? firstPage : [finalProduct],
            total: 101,
            limit: 100,
            offset: Number(offset),
          },
        });
      }),
    );

    renderPage();
    await screen.findByText("SO-001");
    await user.click(screen.getByRole("button", { name: "Create Draft" }));
    const dialog = screen.getByRole("dialog");

    await within(dialog).findByRole("option", { name: /CUST-100/ });
    await user.click(
      within(dialog).getByRole("button", { name: "Load more customers" }),
    );
    expect(
      await within(dialog).findByRole("option", { name: /CUST-101/ }),
    ).toBeInTheDocument();
    await user.selectOptions(
      within(dialog).getByLabelText("Customer"),
      finalCustomer.id,
    );

    await within(dialog).findByRole("option", { name: /WH-100/ });
    await user.click(
      within(dialog).getByRole("button", { name: "Load more warehouses" }),
    );
    expect(
      await within(dialog).findByRole("option", { name: /WH-101/ }),
    ).toBeInTheDocument();
    await user.selectOptions(
      within(dialog).getByLabelText("Warehouse"),
      finalWarehouse.id,
    );

    await within(dialog).findByRole("option", { name: /SKU-100/ });
    await user.click(
      within(dialog).getByRole("button", { name: "Load more products" }),
    );

    const finalOption = await within(dialog).findByRole("option", {
      name: /SKU-101 — Product 101/,
    });
    await user.selectOptions(
      within(dialog).getByLabelText("Product"),
      finalProduct.id,
    );

    expect(finalOption).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Product")).toHaveValue("101");
    expect(requestedOffsets).toContain("100");
    expect(within(dialog).getByLabelText("Customer")).toHaveValue(
      "customer-101",
    );
    expect(within(dialog).getByLabelText("Warehouse")).toHaveValue(
      "warehouse-101",
    );
  });

  it("shows a retry action when loading the next product page fails", async () => {
    installHandlers();
    const user = userEvent.setup();
    const { firstPage, finalProduct } = pagedProducts();
    let nextPageAttempts = 0;

    server.use(
      http.get(`${API_URL}/products`, ({ request }) => {
        const url = new URL(request.url);
        const offset = Number(url.searchParams.get("offset") ?? 0);

        if (offset === 100) {
          nextPageAttempts += 1;
          if (nextPageAttempts === 1) {
            return HttpResponse.json(
              { message: "Product options temporarily unavailable." },
              { status: 503 },
            );
          }
        }

        return HttpResponse.json({
          status: "success",
          data: {
            products: offset === 0 ? firstPage : [finalProduct],
            total: 101,
            limit: 100,
            offset,
          },
        });
      }),
    );

    renderPage();
    await screen.findByText("SO-001");
    await user.click(screen.getByRole("button", { name: "Create Draft" }));
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByRole("option", { name: /SKU-100/ });
    await user.click(
      within(dialog).getByRole("button", { name: "Load more products" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Unable to load more products: Product options temporarily unavailable.",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: "Retry loading more products",
      }),
    );

    expect(
      await within(dialog).findByRole("option", {
        name: /SKU-101 — Product 101/,
      }),
    ).toBeInTheDocument();
    expect(nextPageAttempts).toBe(2);
  });

  it("searches product options server-side without losing the selected product", async () => {
    installHandlers();
    const user = userEvent.setup();
    const matchingProduct = {
      id: "product-target",
      categoryId: "4",
      sku: "SKU-TARGET",
      name: "Target Product",
      description: null,
      unitPrice: "10000",
      isActive: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };
    const receivedSearches: string[] = [];

    server.use(
      http.get(`${API_URL}/products`, ({ request }) => {
        const url = new URL(request.url);
        const search = url.searchParams.get("search") ?? "";
        receivedSearches.push(search);

        return HttpResponse.json({
          status: "success",
          data: {
            products: search
              ? [matchingProduct]
              : [
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
        });
      }),
    );

    renderPage();
    await screen.findByText("SO-001");
    await user.click(screen.getByRole("button", { name: "Create Draft" }));
    const dialog = screen.getByRole("dialog");
    const productSelect = within(dialog).getByLabelText("Product");
    await within(dialog).findByRole("option", { name: /SKU-001 — Widget/ });
    await user.selectOptions(productSelect, "3");

    await user.type(
      within(dialog).getByRole("searchbox", { name: "Search products" }),
      "target",
    );
    expect(
      await within(dialog).findByRole("option", {
        name: /SKU-TARGET — Target Product/,
      }),
    ).toBeInTheDocument();

    expect(productSelect).toHaveValue("3");
    expect(
      within(dialog).getByRole("option", { name: /SKU-001 — Widget/ }),
    ).toBeInTheDocument();
    await user.selectOptions(productSelect, matchingProduct.id);
    expect(productSelect).toHaveValue(matchingProduct.id);
    expect(receivedSearches).toContain("target");
  });

  it("shows and retries customer option query errors", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    installHandlers();
    server.use(
      http.get(`${API_URL}/customers`, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json(
            { message: "Customer options unavailable." },
            { status: 503 },
          );
        }

        return HttpResponse.json({
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
        });
      }),
    );

    renderPage();
    await screen.findByText("SO-001");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load customers: Customer options unavailable.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("option", { name: /CUST-001/ }),
    ).toBeInTheDocument();
    expect(attempts).toBe(2);
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
    await user.click(screen.getByRole("button", { name: "Confirm Order" }));
    await user.click(screen.getByRole("button", { name: "Confirm order" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Order confirmed.",
    );
  });

  it("announces order workflow mutation errors assertively", async () => {
    installHandlers();
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/orders/11/confirm`, () =>
        HttpResponse.json(
          { status: "error", message: "Insufficient stock." },
          { status: 409 },
        ),
      ),
    );
    renderPage("WAREHOUSE_STAFF");
    await screen.findByText("SO-001");
    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(
      await screen.findByRole("button", { name: "Confirm Order" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirm order" }));

    const mutationError = await screen.findByRole("alert");
    expect(mutationError).toHaveAttribute("aria-live", "assertive");
    expect(mutationError).toHaveTextContent("Insufficient stock.");
  });
});
