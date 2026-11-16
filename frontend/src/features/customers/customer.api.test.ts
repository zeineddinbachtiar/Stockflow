import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import {
  createCustomer,
  getCustomerById,
  getCustomers,
  updateCustomer,
} from "./customer.api";
import type { Customer } from "./customer.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");
const TOKEN = "test-access-token";

const customer: Customer = {
  id: "customer-001",
  customerCode: "CUST-001",
  name: "PT Maju Jaya",
  email: "contact@maju.test",
  phone: "+6221123456",
  address: "Jakarta",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const envelope = <T>(data: T) => ({ status: "success" as const, data });

describe("Customer API", () => {
  it("gets customers with pagination and authorization", async () => {
    server.use(
      http.get(`${API_URL}/customers`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("limit")).toBe("10");
        expect(url.searchParams.get("offset")).toBe("20");
        expect(request.headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
        return HttpResponse.json(
          envelope({ customers: [customer], total: 1, limit: 10, offset: 20 }),
        );
      }),
    );

    await expect(getCustomers(TOKEN, 10, 20)).resolves.toEqual({
      customers: [customer],
      total: 1,
      limit: 10,
      offset: 20,
    });
  });

  it("gets customer detail", async () => {
    server.use(
      http.get(`${API_URL}/customers/:id`, ({ params }) => {
        expect(params.id).toBe(customer.id);
        return HttpResponse.json(envelope({ customer }));
      }),
    );

    await expect(getCustomerById(TOKEN, customer.id)).resolves.toEqual(
      customer,
    );
  });

  it("creates a customer", async () => {
    let receivedBody: unknown;
    const payload = {
      customerCode: "CUST-002",
      name: "PT Baru",
      email: null,
      phone: null,
      address: "Bandung",
    };

    server.use(
      http.post(`${API_URL}/customers`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(envelope({ customer }), { status: 201 });
      }),
    );

    await expect(createCustomer(TOKEN, payload)).resolves.toEqual(customer);
    expect(receivedBody).toEqual(payload);
  });

  it("updates a customer by ID", async () => {
    let receivedBody: unknown;
    server.use(
      http.patch(`${API_URL}/customers/:id`, async ({ params, request }) => {
        expect(params.id).toBe(customer.id);
        receivedBody = await request.json();
        return HttpResponse.json(
          envelope({ customer: { ...customer, name: "PT Updated" } }),
        );
      }),
    );

    await expect(
      updateCustomer(TOKEN, customer.id, { name: "PT Updated" }),
    ).resolves.toMatchObject({ name: "PT Updated" });
    expect(receivedBody).toEqual({ name: "PT Updated" });
  });
});
