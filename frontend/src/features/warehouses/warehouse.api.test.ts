import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import {
  createWarehouse,
  deactivateWarehouse,
  getWarehouseById,
  getWarehouses,
  reactivateWarehouse,
  updateWarehouse,
} from "./warehouse.api";
import type { Warehouse } from "./warehouse.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const TOKEN = "test-access-token";

const warehouse: Warehouse = {
  id: "warehouse-001",
  code: "WH-JKT",
  name: "Jakarta Central Warehouse",
  address: "Central Jakarta",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const envelope = <T>(data: T) => ({
  status: "success" as const,
  data,
});

describe("Warehouse API", () => {
  it("gets warehouses with pagination and authorization", async () => {
    let receivedAuthorization: string | null = null;

    server.use(
      http.get(`${API_URL}/warehouses`, ({ request }) => {
        const url = new URL(request.url);
        receivedAuthorization = request.headers.get("Authorization");

        expect(url.searchParams.get("limit")).toBe("10");
        expect(url.searchParams.get("offset")).toBe("20");

        return HttpResponse.json(
          envelope({
            warehouses: [warehouse],
            total: 1,
            limit: 10,
            offset: 20,
          }),
        );
      }),
    );

    const result = await getWarehouses(TOKEN, 10, 20);

    expect(receivedAuthorization).toBe(`Bearer ${TOKEN}`);
    expect(result.warehouses).toEqual([warehouse]);
    expect(result.total).toBe(1);
  });

  it("uses default pagination when arguments are omitted", async () => {
    server.use(
      http.get(`${API_URL}/warehouses`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.searchParams.get("limit")).toBe("10");
        expect(url.searchParams.get("offset")).toBe("0");

        return HttpResponse.json(
          envelope({
            warehouses: [warehouse],
            total: 1,
            limit: 10,
            offset: 0,
          }),
        );
      }),
    );

    const result = await getWarehouses(TOKEN);

    expect(result.warehouses).toEqual([warehouse]);
    expect(result.offset).toBe(0);
  });

  it("gets warehouse details by ID", async () => {
    server.use(
      http.get(`${API_URL}/warehouses/:id`, ({ params }) => {
        expect(params.id).toBe(warehouse.id);
        return HttpResponse.json(envelope({ warehouse }));
      }),
    );

    await expect(getWarehouseById(TOKEN, warehouse.id)).resolves.toEqual(
      warehouse,
    );
  });

  it("creates a warehouse with the supplied payload", async () => {
    let receivedBody: unknown;

    const payload = {
      code: "WH-SBY",
      name: "Surabaya Distribution Center",
      address: "Surabaya",
    };

    server.use(
      http.post(`${API_URL}/warehouses`, async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json(envelope({ warehouse }), {
          status: 201,
        });
      }),
    );

    const result = await createWarehouse(TOKEN, payload);

    expect(receivedBody).toEqual(payload);
    expect(result).toEqual(warehouse);
  });

  it("updates a warehouse", async () => {
    let receivedBody: unknown;

    server.use(
      http.patch(`${API_URL}/warehouses/:id`, async ({ params, request }) => {
        expect(params.id).toBe(warehouse.id);
        receivedBody = await request.json();

        return HttpResponse.json(
          envelope({
            warehouse: {
              ...warehouse,
              name: "Updated Warehouse",
            },
          }),
        );
      }),
    );

    const result = await updateWarehouse(TOKEN, warehouse.id, {
      name: "Updated Warehouse",
    });

    expect(receivedBody).toEqual({
      name: "Updated Warehouse",
    });
    expect(result.name).toBe("Updated Warehouse");
  });

  it("deactivates a warehouse", async () => {
    server.use(
      http.patch(`${API_URL}/warehouses/:id/deactivate`, ({ params }) => {
        expect(params.id).toBe(warehouse.id);

        return HttpResponse.json(
          envelope({
            warehouse: {
              ...warehouse,
              isActive: false,
            },
          }),
        );
      }),
    );

    const result = await deactivateWarehouse(TOKEN, warehouse.id);

    expect(result.isActive).toBe(false);
  });

  it("reactivates a warehouse", async () => {
    server.use(
      http.patch(`${API_URL}/warehouses/:id/reactivate`, ({ params }) => {
        expect(params.id).toBe(warehouse.id);
        return HttpResponse.json(envelope({ warehouse }));
      }),
    );

    const result = await reactivateWarehouse(TOKEN, warehouse.id);

    expect(result.isActive).toBe(true);
  });
});
