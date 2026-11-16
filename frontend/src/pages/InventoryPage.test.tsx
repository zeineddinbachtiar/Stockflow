import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import InventoryPage from "./InventoryPage";
import type { InventoryBalance } from "../features/inventory/inventory.types";
import type { Product } from "../features/products/product.types";
import type { Warehouse } from "../features/warehouses/warehouse.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const warehouse: Warehouse = {
  id: "warehouse-001",
  code: "WH-JKT",
  name: "Jakarta Central Warehouse",
  address: "Jakarta",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const product: Product = {
  id: "product-001",
  categoryId: "category-001",
  sku: "LAP-001",
  name: "Business Laptop",
  description: null,
  unitPrice: "100.00",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const inventory: InventoryBalance = {
  id: "inventory-001",
  warehouseId: warehouse.id,
  warehouseCode: warehouse.code,
  warehouseName: warehouse.name,
  warehouseIsActive: true,
  productId: product.id,
  productSku: product.sku,
  productName: product.name,
  productIsActive: true,
  quantityOnHand: 12,
  reorderLevel: 5,
  isLowStock: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const success = <T,>(data: T) => ({ status: "success" as const, data });

function installInventoryHandlers() {
  let current = { ...inventory };
  let receiptPayload: unknown;

  server.use(
    http.get(`${API_URL}/inventory`, () =>
      HttpResponse.json(
        success({ inventory: [current], total: 1, limit: 10, offset: 0 }),
      ),
    ),
    http.get(`${API_URL}/inventory/:id`, () =>
      HttpResponse.json(success({ inventory: current })),
    ),
    http.get(`${API_URL}/warehouses`, () =>
      HttpResponse.json(
        success({ warehouses: [warehouse], total: 1, limit: 100, offset: 0 }),
      ),
    ),
    http.get(`${API_URL}/products`, () =>
      HttpResponse.json(
        success({ products: [product], total: 1, limit: 100, offset: 0 }),
      ),
    ),
    http.post(`${API_URL}/inventory/receipts`, async ({ request }) => {
      receiptPayload = await request.json();
      current = { ...current, quantityOnHand: current.quantityOnHand + 4 };
      return HttpResponse.json(success({ inventory: current, movement: {} }), {
        status: 201,
      });
    }),
    http.patch(
      `${API_URL}/inventory/:id/reorder-level`,
      async ({ request }) => {
        const payload = (await request.json()) as { reorderLevel: number };
        current = { ...current, reorderLevel: payload.reorderLevel };
        return HttpResponse.json(success({ inventory: current }));
      },
    ),
  );

  return { getReceiptPayload: () => receiptPayload };
}

describe("InventoryPage", () => {
  it("shows balances, detail, filters, and pagination data", async () => {
    installInventoryHandlers();
    renderWithProviders(<InventoryPage />);

    expect(await screen.findByText("Business Laptop")).toBeInTheDocument();
    const inventoryTable = screen.getByRole("table");
    expect(inventoryTable.parentElement).toHaveClass(
      "overflow-x-auto",
      "overscroll-x-contain",
    );
    expect(inventoryTable).toHaveClass("min-w-[950px]");
    expect(inventoryTable).toHaveClass("responsive-data-table");
    expect(
      inventoryTable.querySelector('[data-label="Reorder level"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toHaveClass(
      "sticky",
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "View" }));
    expect(
      await screen.findByRole("heading", { name: "Inventory Detail" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("WH-JKT — Jakarta Central Warehouse"),
    ).toBeInTheDocument();
  });

  it("allows ADMIN to receive stock and invalidates the balance query", async () => {
    const user = userEvent.setup();
    const handlers = installInventoryHandlers();
    renderWithProviders(<InventoryPage />);

    await screen.findByText("Business Laptop");
    await user.click(screen.getByRole("button", { name: /Receive Stock/ }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(
      dialog.querySelectorAll("select")[0]!,
      warehouse.id,
    );
    await user.selectOptions(dialog.querySelectorAll("select")[1]!, product.id);
    await user.type(dialog.querySelector("input[type=number]")!, "4");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(handlers.getReceiptPayload()).toEqual({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 4,
        reason: null,
      }),
    );
    const successMessage = await screen.findByRole("status");
    expect(successMessage).toHaveAttribute("aria-live", "polite");
    expect(successMessage).toHaveTextContent("successfully");
  });

  it("keeps SALES_STAFF read-only", async () => {
    installInventoryHandlers();
    renderWithProviders(<InventoryPage />, "SALES_STAFF");

    expect(await screen.findByText("Business Laptop")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Receive Stock/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Issue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Adjust" }),
    ).not.toBeInTheDocument();
  });

  it("shows and retries a warehouse option query error", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    installInventoryHandlers();
    server.use(
      http.get(`${API_URL}/warehouses`, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json(
            { message: "Warehouse service unavailable." },
            { status: 503 },
          );
        }

        return HttpResponse.json(
          success({ warehouses: [warehouse], total: 1, limit: 100, offset: 0 }),
        );
      }),
    );

    renderWithProviders(<InventoryPage />);
    expect(await screen.findByText("Business Laptop")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load warehouses: Warehouse service unavailable.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("option", { name: "WH-JKT" }),
    ).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("shows option errors and retry inside the stock operation form", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    installInventoryHandlers();
    server.use(
      http.get(`${API_URL}/products`, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json(
            { message: "Product service unavailable." },
            { status: 503 },
          );
        }

        return HttpResponse.json(
          success({ products: [product], total: 1, limit: 100, offset: 0 }),
        );
      }),
    );

    renderWithProviders(<InventoryPage />);
    await screen.findByText("Business Laptop");
    await user.click(screen.getByRole("button", { name: /Receive Stock/ }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Unable to load products: Product service unavailable.",
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Retry",
      }),
    );
    expect(
      await within(screen.getByRole("dialog")).findByRole("option", {
        name: /LAP-001/,
      }),
    ).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
});
