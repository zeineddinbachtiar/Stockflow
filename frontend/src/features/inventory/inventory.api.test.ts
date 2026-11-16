import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import {
  adjustStock,
  getInventory,
  getInventoryById,
  issueStock,
  receiveStock,
  updateReorderLevel,
} from "./inventory.api";
import type { InventoryBalance } from "./inventory.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");
const TOKEN = "test-access-token";

const inventory: InventoryBalance = {
  id: "inventory-001",
  warehouseId: "warehouse-001",
  warehouseCode: "WH-JKT",
  warehouseName: "Jakarta Central Warehouse",
  warehouseIsActive: true,
  productId: "product-001",
  productSku: "LAP-001",
  productName: "Business Laptop",
  productIsActive: true,
  quantityOnHand: 12,
  reorderLevel: 5,
  isLowStock: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const envelope = <T>(data: T) => ({ status: "success" as const, data });

describe("Inventory API", () => {
  it("gets balances with filters and pagination", async () => {
    server.use(
      http.get(`${API_URL}/inventory`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("warehouseId")).toBe("warehouse-001");
        expect(url.searchParams.get("productId")).toBe("product-001");
        expect(url.searchParams.get("lowStock")).toBe("true");
        expect(url.searchParams.get("limit")).toBe("10");
        expect(url.searchParams.get("offset")).toBe("20");
        expect(request.headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);

        return HttpResponse.json(
          envelope({ inventory: [inventory], total: 1, limit: 10, offset: 20 }),
        );
      }),
    );

    await expect(
      getInventory(TOKEN, {
        warehouseId: "warehouse-001",
        productId: "product-001",
        lowStock: true,
        limit: 10,
        offset: 20,
      }),
    ).resolves.toEqual({
      inventory: [inventory],
      total: 1,
      limit: 10,
      offset: 20,
    });
  });

  it("gets a balance detail", async () => {
    server.use(
      http.get(`${API_URL}/inventory/:id`, ({ params }) => {
        expect(params.id).toBe(inventory.id);
        return HttpResponse.json(envelope({ inventory }));
      }),
    );

    await expect(getInventoryById(TOKEN, inventory.id)).resolves.toEqual(
      inventory,
    );
  });

  it.each([
    [
      "receipts",
      receiveStock,
      {
        warehouseId: inventory.warehouseId,
        productId: inventory.productId,
        quantity: 4,
        reason: null,
      },
    ],
    [
      "issues",
      issueStock,
      {
        warehouseId: inventory.warehouseId,
        productId: inventory.productId,
        quantity: 2,
        reason: "Customer shipment",
      },
    ],
    [
      "adjustments",
      adjustStock,
      {
        warehouseId: inventory.warehouseId,
        productId: inventory.productId,
        quantityDelta: -3,
        reason: "Cycle count",
      },
    ],
  ])("posts %s with the backend payload", async (path, operation, payload) => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/inventory/${path}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          envelope({ inventory, movement: { id: "movement-001" } }),
          { status: 201 },
        );
      }),
    );

    await operation(TOKEN, payload as never);
    expect(body).toEqual(payload);
  });

  it("updates the reorder level by inventory ID", async () => {
    let body: unknown;
    server.use(
      http.patch(
        `${API_URL}/inventory/:id/reorder-level`,
        async ({ params, request }) => {
          expect(params.id).toBe(inventory.id);
          body = await request.json();
          return HttpResponse.json(
            envelope({ inventory: { ...inventory, reorderLevel: 9 } }),
          );
        },
      ),
    );

    await expect(
      updateReorderLevel(TOKEN, inventory.id, { reorderLevel: 9 }),
    ).resolves.toMatchObject({ reorderLevel: 9 });
    expect(body).toEqual({ reorderLevel: 9 });
  });
});
