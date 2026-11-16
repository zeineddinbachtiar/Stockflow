import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import { getStockMovementById, getStockMovements } from "./stock-movement.api";
import type { StockMovement } from "../inventory/inventory.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");
const TOKEN = "test-access-token";

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

const envelope = <T>(data: T) => ({ status: "success" as const, data });

describe("Stock movement API", () => {
  it("gets movements with filters, pagination, and authorization", async () => {
    server.use(
      http.get(`${API_URL}/stock-movements`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("warehouseId")).toBe("warehouse-001");
        expect(url.searchParams.get("productId")).toBe("product-001");
        expect(url.searchParams.get("movementType")).toBe("ORDER_CONFIRM");
        expect(url.searchParams.get("limit")).toBe("10");
        expect(url.searchParams.get("offset")).toBe("20");
        expect(request.headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);

        return HttpResponse.json(
          envelope({ movements: [movement], total: 1, limit: 10, offset: 20 }),
        );
      }),
    );

    await expect(
      getStockMovements(TOKEN, {
        warehouseId: "warehouse-001",
        productId: "product-001",
        movementType: "ORDER_CONFIRM",
        limit: 10,
        offset: 20,
      }),
    ).resolves.toEqual({
      movements: [movement],
      total: 1,
      limit: 10,
      offset: 20,
    });
  });

  it("gets movement details by ID", async () => {
    server.use(
      http.get(`${API_URL}/stock-movements/:id`, ({ params }) => {
        expect(params.id).toBe(movement.id);
        return HttpResponse.json(envelope({ movement }));
      }),
    );

    await expect(getStockMovementById(TOKEN, movement.id)).resolves.toEqual(
      movement,
    );
  });
});
