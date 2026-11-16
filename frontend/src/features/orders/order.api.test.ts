import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import {
  cancelOrder,
  confirmOrder,
  createOrder,
  getOrderById,
  getOrders,
  updateOrder,
} from "./order.api";
import { server } from "../../test/mocks/server";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const order = {
  id: "11",
  orderNumber: "SO-test",
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
};

describe("order API", () => {
  it("lists orders with supported filters", async () => {
    server.use(
      http.get(`${API_URL}/orders`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("status")).toBe("DRAFT");
        expect(url.searchParams.get("customerId")).toBe("1");
        expect(url.searchParams.get("warehouseId")).toBe("2");
        return HttpResponse.json({
          status: "success",
          data: { orders: [order], total: 1, limit: 10, offset: 0 },
        });
      }),
    );

    await expect(
      getOrders("token", {
        status: "DRAFT",
        customerId: "1",
        warehouseId: "2",
        limit: 10,
        offset: 0,
      }),
    ).resolves.toMatchObject({ total: 1 });
  });

  it("uses the actual detail and workflow endpoints", async () => {
    const calls: string[] = [];
    server.use(
      http.get(`${API_URL}/orders/11`, () =>
        HttpResponse.json({ status: "success", data: { order } }),
      ),
      http.post(`${API_URL}/orders/11/confirm`, () => {
        calls.push("confirm");
        return HttpResponse.json({ status: "success", data: { order } });
      }),
      http.post(`${API_URL}/orders/11/cancel`, () => {
        calls.push("cancel");
        return HttpResponse.json({ status: "success", data: { order } });
      }),
    );

    await expect(getOrderById("token", "11")).resolves.toMatchObject({
      id: "11",
    });
    await confirmOrder("token", "11");
    await cancelOrder("token", "11");
    expect(calls).toEqual(["confirm", "cancel"]);
  });

  it("sends create and update payloads without trusting price fields", async () => {
    let createBody: unknown;
    let updateBody: unknown;
    server.use(
      http.post(`${API_URL}/orders`, async ({ request }) => {
        createBody = await request.json();
        return HttpResponse.json({ status: "success", data: { order } });
      }),
      http.patch(`${API_URL}/orders/11`, async ({ request }) => {
        updateBody = await request.json();
        return HttpResponse.json({ status: "success", data: { order } });
      }),
    );

    await createOrder("token", {
      customerId: "1",
      warehouseId: "2",
      items: [{ productId: "3", quantity: 4 }],
    });
    await updateOrder("token", "11", { customerId: "4" });
    expect(createBody).toEqual({
      customerId: "1",
      warehouseId: "2",
      items: [{ productId: "3", quantity: 4 }],
    });
    expect(updateBody).toEqual({ customerId: "4" });
  });
});
