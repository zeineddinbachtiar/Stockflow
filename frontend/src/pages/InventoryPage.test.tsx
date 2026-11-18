import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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

function installInventoryHandlers(
  initialInventory: InventoryBalance = inventory,
  availableProducts: Product[] = [product],
) {
  let current = { ...initialInventory };
  let receiptPayload: unknown;
  let issuePayload: unknown;
  let adjustmentPayload: unknown;
  let reorderPayload: unknown;

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
        success({
          products: availableProducts,
          total: availableProducts.length,
          limit: 100,
          offset: 0,
        }),
      ),
    ),
    http.post(`${API_URL}/inventory/receipts`, async ({ request }) => {
      receiptPayload = await request.json();
      const payload = receiptPayload as { quantity: number };
      current = {
        ...current,
        quantityOnHand: current.quantityOnHand + payload.quantity,
      };
      return HttpResponse.json(success({ inventory: current, movement: {} }), {
        status: 201,
      });
    }),
    http.post(`${API_URL}/inventory/issues`, async ({ request }) => {
      issuePayload = await request.json();
      const payload = issuePayload as { quantity: number };
      current = {
        ...current,
        quantityOnHand: current.quantityOnHand - payload.quantity,
      };
      return HttpResponse.json(success({ inventory: current, movement: {} }), {
        status: 201,
      });
    }),
    http.post(`${API_URL}/inventory/adjustments`, async ({ request }) => {
      adjustmentPayload = await request.json();
      const payload = adjustmentPayload as { quantityDelta: number };
      current = {
        ...current,
        quantityOnHand: current.quantityOnHand + payload.quantityDelta,
      };
      return HttpResponse.json(success({ inventory: current, movement: {} }), {
        status: 201,
      });
    }),
    http.patch(
      `${API_URL}/inventory/:id/reorder-level`,
      async ({ request }) => {
        reorderPayload = await request.json();
        const payload = reorderPayload as { reorderLevel: number };
        current = { ...current, reorderLevel: payload.reorderLevel };
        return HttpResponse.json(success({ inventory: current }));
      },
    ),
  );

  return {
    getReceiptPayload: () => receiptPayload,
    getIssuePayload: () => issuePayload,
    getAdjustmentPayload: () => adjustmentPayload,
    getReorderPayload: () => reorderPayload,
  };
}

async function fillStockOperation(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  quantity: string,
  reason?: string,
) {
  const selects = dialog.querySelectorAll("select");
  await user.selectOptions(selects[0]!, warehouse.id);
  await user.selectOptions(selects[1]!, product.id);

  const quantityInput = dialog.querySelector('input[type="number"]')!;
  await user.clear(quantityInput);
  await user.type(quantityInput, quantity);

  if (reason !== undefined) {
    await user.type(dialog.querySelector("textarea")!, reason);
  }
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
    expect(await screen.findByText("16")).toBeInTheDocument();
  });

  it("allows WAREHOUSE_STAFF to perform stock operations", async () => {
    const user = userEvent.setup();
    const handlers = installInventoryHandlers();
    renderWithProviders(<InventoryPage />, "WAREHOUSE_STAFF");

    await screen.findByText("Business Laptop");
    expect(
      screen.getByRole("button", { name: /Receive Stock/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Issue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjust" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Update reorder level for Business Laptop",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Receive Stock/ }));
    const dialog = screen.getByRole("dialog");
    await fillStockOperation(user, dialog, "1");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(handlers.getReceiptPayload()).toMatchObject({
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: 1,
      }),
    );
    expect(await screen.findByText("13")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Update reorder level for Business Laptop",
      }),
    );
    const reorderDialog = screen.getByRole("dialog");
    const reorderInput = within(reorderDialog).getByLabelText("Reorder level");
    await user.clear(reorderInput);
    await user.type(reorderInput, "7");
    await user.click(
      within(reorderDialog).getByRole("button", { name: "Save" }),
    );

    await waitFor(() =>
      expect(handlers.getReorderPayload()).toEqual({ reorderLevel: 7 }),
    );
    expect(await screen.findByText("7")).toBeInTheDocument();
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
    expect(
      screen.queryByRole("button", {
        name: "Update reorder level for Business Laptop",
      }),
    ).not.toBeInTheDocument();
  });

  it("issues active stock and refreshes the displayed balance", async () => {
    const user = userEvent.setup();
    const handlers = installInventoryHandlers();
    renderWithProviders(<InventoryPage />);

    await screen.findByText("Business Laptop");
    await user.click(screen.getByRole("button", { name: "Issue" }));
    const dialog = screen.getByRole("dialog");
    await fillStockOperation(user, dialog, "2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Issue stock" }),
    );

    await waitFor(() =>
      expect(handlers.getIssuePayload()).toMatchObject({
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: 2,
      }),
    );
    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Inventory updated successfully.",
    );
  });

  it("applies positive and negative adjustments and refreshes the balance", async () => {
    const user = userEvent.setup();
    const handlers = installInventoryHandlers();
    renderWithProviders(<InventoryPage />);

    await screen.findByText("Business Laptop");
    await user.click(screen.getByRole("button", { name: "Adjust" }));
    let dialog = screen.getByRole("dialog");
    await fillStockOperation(user, dialog, "3", "Count increase");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Apply adjustment" }),
    );

    await waitFor(() =>
      expect(handlers.getAdjustmentPayload()).toMatchObject({
        productId: product.id,
        warehouseId: warehouse.id,
        quantityDelta: 3,
        reason: "Count increase",
      }),
    );
    expect(await screen.findByText("15")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Adjust" }));
    dialog = screen.getByRole("dialog");
    await fillStockOperation(user, dialog, "-2", "Count decrease");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Apply adjustment" }),
    );

    await waitFor(() =>
      expect(handlers.getAdjustmentPayload()).toMatchObject({
        productId: product.id,
        warehouseId: warehouse.id,
        quantityDelta: -2,
        reason: "Count decrease",
      }),
    );
    expect(await screen.findByText("13")).toBeInTheDocument();
  });

  it("updates the reorder level and refreshes the displayed value", async () => {
    const user = userEvent.setup();
    const handlers = installInventoryHandlers();
    renderWithProviders(<InventoryPage />);

    await screen.findByText("Business Laptop");
    await user.click(
      screen.getByRole("button", {
        name: "Update reorder level for Business Laptop",
      }),
    );
    const dialog = screen.getByRole("dialog");
    const reorderInput = within(dialog).getByLabelText("Reorder level");
    await user.clear(reorderInput);
    await user.type(reorderInput, "8");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(handlers.getReorderPayload()).toEqual({ reorderLevel: 8 }),
    );
    expect(await screen.findByText("8")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Inventory updated successfully.",
    );
  });

  it("shows a receipt API error without changing the balance", async () => {
    const user = userEvent.setup();
    installInventoryHandlers();
    server.use(
      http.post(`${API_URL}/inventory/receipts`, () =>
        HttpResponse.json(
          { message: "Receipt could not be recorded." },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<InventoryPage />);
    await screen.findByText("Business Laptop");
    await user.click(screen.getByRole("button", { name: /Receive Stock/ }));
    const dialog = screen.getByRole("dialog");
    await fillStockOperation(user, dialog, "2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Receipt could not be recorded.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows an insufficient-stock issue error and preserves the balance", async () => {
    const user = userEvent.setup();
    installInventoryHandlers();
    server.use(
      http.post(`${API_URL}/inventory/issues`, () =>
        HttpResponse.json(
          {
            code: "INSUFFICIENT_STOCK",
            message: "Insufficient stock. Available quantity: 12.",
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<InventoryPage />);
    await screen.findByText("Business Laptop");
    await user.click(screen.getByRole("button", { name: "Issue" }));
    let dialog = screen.getByRole("dialog");
    await fillStockOperation(user, dialog, "13");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Issue stock" }),
    );

    dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Insufficient stock. Available quantity: 12.",
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows an insufficient-stock adjustment error and preserves the balance", async () => {
    const user = userEvent.setup();
    installInventoryHandlers();
    server.use(
      http.post(`${API_URL}/inventory/adjustments`, () =>
        HttpResponse.json(
          {
            code: "INSUFFICIENT_STOCK",
            message: "Insufficient stock. Available quantity: 12.",
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<InventoryPage />);
    await screen.findByText("Business Laptop");
    await user.click(screen.getByRole("button", { name: "Adjust" }));
    let dialog = screen.getByRole("dialog");
    await fillStockOperation(user, dialog, "-13", "Cycle count");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(
      await screen.findByRole("button", { name: "Apply adjustment" }),
    );

    dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Insufficient stock. Available quantity: 12.",
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows reorder-level API errors and retains the prior value", async () => {
    const user = userEvent.setup();
    installInventoryHandlers();
    server.use(
      http.patch(`${API_URL}/inventory/:id/reorder-level`, () =>
        HttpResponse.json(
          { message: "Reorder level could not be updated." },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<InventoryPage />);
    await screen.findByText("Business Laptop");
    await user.click(
      screen.getByRole("button", {
        name: "Update reorder level for Business Laptop",
      }),
    );
    const dialog = screen.getByRole("dialog");
    const reorderInput = within(dialog).getByLabelText("Reorder level");
    await user.clear(reorderInput);
    await user.type(reorderInput, "8");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Reorder level could not be updated.",
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("prevents duplicate submission and closing while a receipt is pending", async () => {
    const user = userEvent.setup();
    installInventoryHandlers();
    let requests = 0;
    let releaseResponse = () => {};
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    server.use(
      http.post(`${API_URL}/inventory/receipts`, async () => {
        requests += 1;
        await responseGate;
        return HttpResponse.json(
          success({
            inventory: { ...inventory, quantityOnHand: 14 },
            movement: {},
          }),
          { status: 201 },
        );
      }),
    );

    renderWithProviders(<InventoryPage />);
    await screen.findByText("Business Laptop");
    await user.click(screen.getByRole("button", { name: /Receive Stock/ }));
    const dialog = screen.getByRole("dialog");
    await fillStockOperation(user, dialog, "2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    try {
      await waitFor(() => {
        expect(requests).toBe(1);
        expect(
          within(dialog).getByRole("button", { name: "Saving..." }),
        ).toBeDisabled();
        expect(
          within(dialog).getByRole("button", {
            name: "Close inventory operation",
          }),
        ).toBeDisabled();
      });

      fireEvent.submit(dialog.querySelector("form")!);
      expect(requests).toBe(1);

      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    } finally {
      releaseResponse();
    }

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Inventory updated successfully.",
    );
  });

  it("shows inactive balances and allows issue clearance from the inventory row", async () => {
    const user = userEvent.setup();
    const inactiveInventory: InventoryBalance = {
      ...inventory,
      productId: "product-inactive",
      productSku: "OLD-001",
      productName: "Retired Laptop",
      productIsActive: false,
      quantityOnHand: 5,
    };
    const handlers = installInventoryHandlers(inactiveInventory);

    renderWithProviders(<InventoryPage />, "WAREHOUSE_STAFF");

    expect(await screen.findByText("Retired Laptop")).toBeInTheDocument();
    expect(
      screen.getByText("Inactive", { selector: "span" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Issue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjust" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Update reorder level for Retired Laptop",
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Issue" }));
    const dialog = screen.getByRole("dialog");
    const selects = dialog.querySelectorAll("select");
    expect(selects[1]).toHaveValue(inactiveInventory.productId);
    expect(selects[1]).toBeDisabled();
    expect(dialog).toHaveTextContent(
      "Inactive product — only stock clearance is allowed.",
    );
    expect(dialog).toHaveTextContent("OLD-001 — Retired Laptop (Inactive)");

    await user.type(dialog.querySelector("input[type=number]")!, "2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Issue stock" }));

    await waitFor(() =>
      expect(handlers.getIssuePayload()).toMatchObject({
        productId: inactiveInventory.productId,
        warehouseId: inactiveInventory.warehouseId,
        quantity: 2,
      }),
    );
  });

  it("allows negative adjustment but blocks positive adjustment for inactive products", async () => {
    const user = userEvent.setup();
    const inactiveInventory: InventoryBalance = {
      ...inventory,
      productId: "product-inactive",
      productSku: "OLD-001",
      productName: "Retired Laptop",
      productIsActive: false,
      quantityOnHand: 5,
    };
    const handlers = installInventoryHandlers(inactiveInventory);

    renderWithProviders(<InventoryPage />, "WAREHOUSE_STAFF");
    await screen.findByText("Retired Laptop");

    await user.click(screen.getByRole("button", { name: "Adjust" }));
    let dialog = screen.getByRole("dialog");
    let quantityInput = dialog.querySelector("input[type=number]")!;
    expect(quantityInput).toHaveAttribute("max", "0");
    await user.type(quantityInput, "-2");
    await user.type(dialog.querySelector("textarea")!, "Clearance");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Apply adjustment" }));

    await waitFor(() =>
      expect(handlers.getAdjustmentPayload()).toMatchObject({
        productId: inactiveInventory.productId,
        warehouseId: inactiveInventory.warehouseId,
        quantityDelta: -2,
        reason: "Clearance",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Adjust" }));
    dialog = screen.getByRole("dialog");
    quantityInput = dialog.querySelector("input[type=number]")!;
    fireEvent.change(quantityInput, { target: { value: "2" } });
    fireEvent.submit(dialog.querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Inactive products only allow negative stock adjustments.",
    );
    expect(
      screen.queryByRole("button", { name: "Apply adjustment" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer inactive products as receipt options", async () => {
    const user = userEvent.setup();
    const inactiveInventory: InventoryBalance = {
      ...inventory,
      productId: "product-inactive",
      productSku: "OLD-001",
      productName: "Retired Laptop",
      productIsActive: false,
    };
    installInventoryHandlers(inactiveInventory);

    renderWithProviders(<InventoryPage />);
    await screen.findByText("Retired Laptop");

    await user.click(screen.getByRole("button", { name: /Receive Stock/ }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("option", { name: /LAP-001/ }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("option", { name: /OLD-001|Retired Laptop/ }),
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
