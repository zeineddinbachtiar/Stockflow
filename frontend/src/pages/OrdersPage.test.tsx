import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import OrdersPage from "./OrdersPage";
import { AuthProvider } from "../context/AuthContext";
import { server } from "../test/mocks/server";
import { getInventory } from "../features/inventory/inventory.api";
import type { InventoryBalance } from "../features/inventory/inventory.types";
import type { Order } from "../features/orders/order.types";

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

function InventoryBalanceProbe() {
  const params = { limit: 10, offset: 0 };
  const inventoryQuery = useQuery({
    queryKey: ["inventory", params],
    queryFn: () => getInventory("token", params),
  });

  return (
    <p>
      Observed stock:{" "}
      {inventoryQuery.data?.inventory[0]?.quantityOnHand ?? "Loading"}
    </p>
  );
}

function renderPage(
  role: "ADMIN" | "SALES_STAFF" | "WAREHOUSE_STAFF" = "ADMIN",
  includeInventoryProbe = false,
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
        {includeInventoryProbe && <InventoryBalanceProbe />}
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function installLifecycleHandlers() {
  const customers = [
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
    {
      id: "5",
      customerCode: "CUST-005",
      name: "Sejahtera",
      email: null,
      phone: null,
      address: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
  ];
  const products = [
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
    {
      id: "4",
      categoryId: "4",
      sku: "SKU-002",
      name: "Gadget",
      description: null,
      unitPrice: "20000",
      isActive: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
  ];
  const warehouse = {
    id: "2",
    code: "WH-001",
    name: "Main",
    address: null,
    isActive: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
  let order: Order | null = null;
  let stock = 10;
  let inventoryRequests = 0;
  let createPayload: unknown;
  let updatePayload: unknown;

  function makeOrderItem(productId: string, quantity: number, index: number) {
    const selectedProduct = products.find((entry) => entry.id === productId)!;
    return {
      id: String(21 + index),
      productId,
      productSku: selectedProduct.sku,
      productName: selectedProduct.name,
      quantity,
      unitPrice: selectedProduct.unitPrice,
      lineTotal: String(Number(selectedProduct.unitPrice) * quantity),
    };
  }

  function orderResponse() {
    return HttpResponse.json({
      status: "success",
      data: { order },
    });
  }

  server.use(
    http.get(`${API_URL}/orders`, () =>
      HttpResponse.json({
        status: "success",
        data: {
          orders: order ? [order] : [],
          total: order ? 1 : 0,
          limit: 10,
          offset: 0,
        },
      }),
    ),
    http.get(`${API_URL}/orders/11`, () => orderResponse()),
    http.post(`${API_URL}/orders`, async ({ request }) => {
      createPayload = await request.json();
      const payload = createPayload as {
        customerId: string;
        warehouseId: string;
        items: Array<{ productId: string; quantity: number }>;
      };
      const customer = customers.find(
        (entry) => entry.id === payload.customerId,
      )!;
      const items = payload.items.map((item, index) =>
        makeOrderItem(item.productId, item.quantity, index),
      );
      order = {
        ...baseOrder,
        orderNumber: "SO-LIFECYCLE",
        customerId: customer.id,
        customerCode: customer.customerCode,
        customerName: customer.name,
        warehouseId: payload.warehouseId,
        createdBy: "user-1",
        createdByName: "SALES_STAFF",
        itemCount: items.length,
        totalAmount: items
          .reduce((total, item) => total + Number(item.lineTotal), 0)
          .toString(),
        items,
      };

      return orderResponse();
    }),
    http.patch(`${API_URL}/orders/11`, async ({ request }) => {
      updatePayload = await request.json();
      const payload = updatePayload as {
        customerId?: string;
        items?: Array<{ productId: string; quantity: number }>;
      };
      if (!order) return HttpResponse.json({}, { status: 404 });

      if (payload.customerId) {
        const customer = customers.find(
          (entry) => entry.id === payload.customerId,
        )!;
        order = {
          ...order,
          customerId: customer.id,
          customerCode: customer.customerCode,
          customerName: customer.name,
        };
      }

      if (payload.items) {
        const items = payload.items.map((item, index) =>
          makeOrderItem(item.productId, item.quantity, index),
        );
        order = {
          ...order,
          items,
          itemCount: items.length,
          totalAmount: items
            .reduce((total, item) => total + Number(item.lineTotal), 0)
            .toString(),
        };
      }

      return orderResponse();
    }),
    http.post(`${API_URL}/orders/11/confirm`, () => {
      if (!order) return HttpResponse.json({}, { status: 404 });
      stock -=
        order.items?.reduce((total, item) => total + item.quantity, 0) ?? 0;
      order = { ...order, status: "CONFIRMED" };
      return orderResponse();
    }),
    http.post(`${API_URL}/orders/11/cancel`, () => {
      if (!order) return HttpResponse.json({}, { status: 404 });
      if (order.status === "CONFIRMED") {
        stock +=
          order.items?.reduce((total, item) => total + item.quantity, 0) ?? 0;
      }
      order = { ...order, status: "CANCELLED" };
      return orderResponse();
    }),
    http.get(`${API_URL}/warehouses`, () =>
      HttpResponse.json({
        status: "success",
        data: { warehouses: [warehouse], total: 1, limit: 100, offset: 0 },
      }),
    ),
    http.get(`${API_URL}/customers`, () =>
      HttpResponse.json({
        status: "success",
        data: { customers, total: customers.length, limit: 100, offset: 0 },
      }),
    ),
    http.get(`${API_URL}/products`, () =>
      HttpResponse.json({
        status: "success",
        data: { products, total: products.length, limit: 100, offset: 0 },
      }),
    ),
    http.get(`${API_URL}/inventory`, () => {
      inventoryRequests += 1;
      const inventory: InventoryBalance = {
        id: "inventory-1",
        warehouseId: warehouse.id,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        warehouseIsActive: true,
        productId: "3",
        productSku: "SKU-001",
        productName: "Widget",
        productIsActive: true,
        quantityOnHand: stock,
        reorderLevel: 2,
        isLowStock: stock <= 2,
        updatedAt: "2026-01-01",
      };
      return HttpResponse.json({
        status: "success",
        data: { inventory: [inventory], total: 1, limit: 10, offset: 0 },
      });
    }),
  );

  return {
    getCreatePayload: () => createPayload,
    getUpdatePayload: () => updatePayload,
    getInventoryRequests: () => inventoryRequests,
  };
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

  it("limits SALES_STAFF to owned orders and draft actions", async () => {
    installHandlers();
    const user = userEvent.setup();
    const otherOrder = {
      ...baseOrder,
      id: "12",
      orderNumber: "SO-OTHER",
      createdBy: "user-2",
    };
    server.use(
      http.get(`${API_URL}/orders`, () =>
        HttpResponse.json({
          status: "success",
          data: { orders: [baseOrder], total: 1, limit: 10, offset: 0 },
        }),
      ),
      http.get(`${API_URL}/orders/12`, () =>
        HttpResponse.json({ status: "success", data: { order: otherOrder } }),
      ),
    );

    renderPage("SALES_STAFF");
    expect(await screen.findByText("SO-001")).toBeInTheDocument();
    expect(screen.queryByText("SO-OTHER")).toBeNull();
    await user.click(screen.getByRole("button", { name: "View" }));
    await screen.findByRole("heading", { name: "Order Detail" });
    expect(screen.getByRole("button", { name: "Edit Draft" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel Order" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Confirm Order" })).toBeNull();
  });

  it("exposes all draft management actions to ADMIN", async () => {
    installHandlers();
    const user = userEvent.setup();
    renderPage("ADMIN");

    expect(await screen.findByText("SO-001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Draft" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "View" }));
    await screen.findByRole("heading", { name: "Order Detail" });
    expect(screen.getByRole("button", { name: "Edit Draft" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirm Order" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel Order" })).toBeEnabled();
  });

  it("completes create, edit, confirm, and cancel with inventory refetch", async () => {
    const user = userEvent.setup();
    const handlers = installLifecycleHandlers();
    const salesView = renderPage("SALES_STAFF", true);

    await screen.findByText("No orders found");
    await user.click(screen.getByRole("button", { name: "Create Draft" }));
    let dialog = screen.getByRole("dialog");

    await user.selectOptions(
      await within(dialog).findByLabelText("Customer"),
      "1",
    );
    await user.selectOptions(within(dialog).getByLabelText("Warehouse"), "2");
    await user.selectOptions(within(dialog).getByLabelText("Product"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));
    const productSelects = within(dialog).getAllByLabelText("Product");
    await user.selectOptions(productSelects[1]!, "4");
    let quantities = within(dialog).getAllByLabelText("Quantity");
    await user.clear(quantities[0]!);
    await user.type(quantities[0]!, "2");
    await user.clear(quantities[1]!);
    await user.type(quantities[1]!, "1");
    await user.click(
      within(dialog).getByRole("button", { name: "Create Draft" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Draft order saved successfully.",
    );
    expect(await screen.findByText("SO-LIFECYCLE")).toBeInTheDocument();
    expect(handlers.getCreatePayload()).toEqual({
      customerId: "1",
      warehouseId: "2",
      items: [
        { productId: "3", quantity: 2 },
        { productId: "4", quantity: 1 },
      ],
    });

    await user.click(screen.getByRole("button", { name: "View" }));
    await screen.findByRole("heading", { name: "Order Detail" });
    expect(
      screen.getByRole("button", { name: "Edit Draft" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm Order" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Cancel Order" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Draft" }));
    dialog = screen.getAllByRole("dialog").at(-1)!;
    await user.selectOptions(within(dialog).getByLabelText("Customer"), "5");
    quantities = within(dialog).getAllByLabelText("Quantity");
    await user.clear(quantities[0]!);
    await user.type(quantities[0]!, "3");
    await user.click(
      within(dialog).getByRole("button", { name: "Save Changes" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Draft order saved successfully.",
    );
    expect(handlers.getUpdatePayload()).toEqual({
      customerId: "5",
      items: [
        { productId: "3", quantity: 3 },
        { productId: "4", quantity: 1 },
      ],
    });
    expect(await screen.findByText("Sejahtera")).toBeInTheDocument();

    salesView.unmount();
    const warehouseView = renderPage("WAREHOUSE_STAFF", true);
    expect(await screen.findByText("Observed stock: 10")).toBeInTheDocument();
    await screen.findByText("SO-LIFECYCLE");
    await user.click(screen.getByRole("button", { name: "View" }));
    await screen.findByRole("heading", { name: "Order Detail" });
    expect(screen.queryByRole("button", { name: "Edit Draft" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel Order" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Confirm Order" }));
    await user.click(screen.getByRole("button", { name: "Confirm order" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Order confirmed.",
    );
    expect(await screen.findByText("CONFIRMED")).toBeInTheDocument();
    expect(await screen.findByText("Observed stock: 6")).toBeInTheDocument();
    expect(handlers.getInventoryRequests()).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole("button", { name: "View" }));
    await screen.findByRole("heading", { name: "Order Detail" });
    await user.click(screen.getByRole("button", { name: "Cancel Order" }));
    await user.click(screen.getByRole("button", { name: "Cancel order" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Order cancelled.",
    );
    expect(await screen.findByText("CANCELLED")).toBeInTheDocument();
    expect(await screen.findByText("Observed stock: 10")).toBeInTheDocument();
    expect(handlers.getInventoryRequests()).toBeGreaterThanOrEqual(3);
    warehouseView.unmount();
  });

  it("shows draft save API errors and keeps the form available for correction", async () => {
    installHandlers();
    const user = userEvent.setup();
    server.use(
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
              {
                id: "5",
                customerCode: "CUST-005",
                name: "Sejahtera",
                email: null,
                phone: null,
                address: null,
                createdAt: "2026-01-01",
                updatedAt: "2026-01-01",
              },
            ],
            total: 2,
            limit: 100,
            offset: 0,
          },
        }),
      ),
      http.post(`${API_URL}/orders`, () =>
        HttpResponse.json(
          { message: "Draft could not be created." },
          { status: 503 },
        ),
      ),
      http.patch(`${API_URL}/orders/11`, () =>
        HttpResponse.json(
          { message: "Draft could not be updated." },
          { status: 503 },
        ),
      ),
    );

    renderPage("ADMIN");
    await screen.findByText("SO-001");
    await user.click(screen.getByRole("button", { name: "Create Draft" }));
    let dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Customer"), "1");
    await user.selectOptions(within(dialog).getByLabelText("Warehouse"), "2");
    await user.selectOptions(within(dialog).getByLabelText("Product"), "3");
    await user.click(
      within(dialog).getByRole("button", { name: "Create Draft" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Draft could not be created.",
    );
    expect(screen.queryByRole("status")).toBeNull();
    await user.click(
      within(dialog).getByRole("button", { name: "Close order form" }),
    );

    await user.click(screen.getByRole("button", { name: "View" }));
    await screen.findByRole("heading", { name: "Order Detail" });
    await user.click(screen.getByRole("button", { name: "Edit Draft" }));
    dialog = screen.getAllByRole("dialog").at(-1)!;
    await user.selectOptions(within(dialog).getByLabelText("Customer"), "5");
    await user.click(
      within(dialog).getByRole("button", { name: "Save Changes" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Draft could not be updated.",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps an inactive-product draft unconfirmed when the API rejects it", async () => {
    installHandlers();
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/orders/11/confirm`, () =>
        HttpResponse.json(
          {
            code: "ORDER_PRODUCT_INACTIVE",
            message: "One or more products are inactive.",
          },
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

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("One or more products are inactive.");
    expect(screen.getAllByText("DRAFT").length).toBeGreaterThan(0);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows cancellation errors without reporting success", async () => {
    installHandlers();
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/orders/11/cancel`, () =>
        HttpResponse.json(
          { message: "Order could not be cancelled." },
          { status: 503 },
        ),
      ),
    );

    renderPage("SALES_STAFF");
    await screen.findByText("SO-001");
    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(
      await screen.findByRole("button", { name: "Cancel Order" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel order" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Order could not be cancelled.",
    );
    expect(screen.getAllByText("DRAFT").length).toBeGreaterThan(0);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("prevents duplicate draft saves and closing while the save is pending", async () => {
    installHandlers();
    const user = userEvent.setup();
    let requests = 0;
    let releaseResponse = () => {};
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    server.use(
      http.post(`${API_URL}/orders`, async () => {
        requests += 1;
        await responseGate;
        return HttpResponse.json({
          status: "success",
          data: { order: baseOrder },
        });
      }),
    );

    renderPage("ADMIN");
    await screen.findByText("SO-001");
    await user.click(screen.getByRole("button", { name: "Create Draft" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Customer"), "1");
    await user.selectOptions(within(dialog).getByLabelText("Warehouse"), "2");
    await user.selectOptions(within(dialog).getByLabelText("Product"), "3");
    await user.click(
      within(dialog).getByRole("button", { name: "Create Draft" }),
    );

    try {
      await within(dialog).findByRole("button", { name: "Saving..." });
      expect(requests).toBe(1);
      expect(
        within(dialog).getByRole("button", { name: "Close order form" }),
      ).toBeDisabled();
      expect(
        within(dialog).getByRole("button", { name: "Cancel" }),
      ).toBeDisabled();

      fireEvent.submit(dialog.querySelector("form")!);
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(requests).toBe(1);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    } finally {
      releaseResponse();
    }

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Draft order saved successfully.",
    );
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
    expect(screen.queryByRole("button", { name: "Create Draft" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "View" }));
    expect(
      await screen.findByRole("button", { name: "Confirm Order" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel Order" }),
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
    expect(screen.getAllByText("DRAFT").length).toBeGreaterThan(0);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
