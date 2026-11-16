import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import type { StockMovement } from "../features/inventory/inventory.types";
import StockMovementsPage from "./StockMovementsPage";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const movement: StockMovement = {
  id: "movement-001",
  warehouseId: "warehouse-001",
  warehouseCode: "WH-JKT",
  warehouseName: "Jakarta Central Warehouse",
  productId: "product-001",
  productSku: "LAP-001",
  productName: "Business Laptop",
  performedBy: "user-001",
  performedByName: "StockFlow Administrator",
  orderId: "order-001",
  movementType: "ORDER_CONFIRM",
  quantityDelta: -2,
  reason: "Order confirmed",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const success = <T,>(data: T) => ({ status: "success" as const, data });

function installHandlers() {
  let listRequests = 0;

  server.use(
    http.get(`${API_URL}/stock-movements`, ({ request }) => {
      listRequests += 1;
      const url = new URL(request.url);
      return HttpResponse.json(
        success({
          movements:
            url.searchParams.get("movementType") === "RECEIPT"
              ? []
              : [movement],
          total: url.searchParams.get("movementType") === "RECEIPT" ? 0 : 1,
          limit: Number(url.searchParams.get("limit")),
          offset: Number(url.searchParams.get("offset")),
        }),
      );
    }),
    http.get(`${API_URL}/stock-movements/:id`, () =>
      HttpResponse.json(success({ movement })),
    ),
    http.get(`${API_URL}/warehouses`, () =>
      HttpResponse.json(
        success({ warehouses: [], total: 0, limit: 100, offset: 0 }),
      ),
    ),
    http.get(`${API_URL}/products`, () =>
      HttpResponse.json(
        success({ products: [], total: 0, limit: 100, offset: 0 }),
      ),
    ),
  );

  return { getListRequests: () => listRequests };
}

describe("StockMovementsPage", () => {
  it("shows read-only movement history and movement detail", async () => {
    installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<StockMovementsPage />, "ADMIN");

    expect(await screen.findByText("Business Laptop")).toBeInTheDocument();
    expect(screen.getAllByText("Order confirmation").length).toBeGreaterThan(1);
    expect(screen.getByText("-2")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit|Delete/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View" }));
    expect(
      await screen.findByRole("heading", { name: "Stock Movement Detail" }),
    ).toBeInTheDocument();
    expect(screen.getByText("StockFlow Administrator")).toBeInTheDocument();
  });

  it("refetches when a movement type filter changes", async () => {
    const handlers = installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<StockMovementsPage />, "WAREHOUSE_STAFF");

    await screen.findByText("Business Laptop");
    await user.selectOptions(screen.getByLabelText("Movement type"), "RECEIPT");

    await waitFor(() => expect(handlers.getListRequests()).toBeGreaterThan(1));
    expect(
      await screen.findByText("No stock movements found"),
    ).toBeInTheDocument();
  });

  it("shows a retry action when the movement list fails", async () => {
    let attempts = 0;
    server.use(
      http.get(`${API_URL}/stock-movements`, () => {
        attempts += 1;
        return HttpResponse.json(
          { message: "Temporary failure." },
          { status: 503 },
        );
      }),
      http.get(`${API_URL}/warehouses`, () =>
        HttpResponse.json(
          success({ warehouses: [], total: 0, limit: 100, offset: 0 }),
        ),
      ),
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json(
          success({ products: [], total: 0, limit: 100, offset: 0 }),
        ),
      ),
    );

    renderWithProviders(<StockMovementsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Temporary failure.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(attempts).toBe(1);
  });
});
