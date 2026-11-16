import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import type { Customer } from "../features/customers/customer.types";
import CustomersPage from "./CustomersPage";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

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

const success = <T,>(data: T) => ({ status: "success" as const, data });

function installCustomerHandlers() {
  const records = [customer];
  let mutationCount = 0;

  server.use(
    http.get(`${API_URL}/customers`, ({ request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit"));
      const offset = Number(url.searchParams.get("offset"));
      return HttpResponse.json(
        success({
          customers: records.slice(offset, offset + limit),
          total: records.length,
          limit,
          offset,
        }),
      );
    }),
    http.get(`${API_URL}/customers/:id`, () =>
      HttpResponse.json(success({ customer: records[0] })),
    ),
    http.post(`${API_URL}/customers`, async ({ request }) => {
      mutationCount += 1;
      const payload = (await request.json()) as Partial<Customer>;
      const created = {
        ...customer,
        id: "customer-new",
        ...payload,
      } as Customer;
      records.push(created);
      return HttpResponse.json(success({ customer: created }), { status: 201 });
    }),
    http.patch(`${API_URL}/customers/:id`, async ({ request }) => {
      mutationCount += 1;
      const payload = (await request.json()) as Partial<Customer>;
      records[0] = { ...records[0], ...payload } as Customer;
      return HttpResponse.json(success({ customer: records[0] }));
    }),
  );

  return { getMutationCount: () => mutationCount };
}

describe("CustomersPage", () => {
  it("shows the directory and customer detail", async () => {
    installCustomerHandlers();
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />, "ADMIN");

    expect(await screen.findByText("PT Maju Jaya")).toBeInTheDocument();
    const customersTable = screen.getByRole("table");
    expect(customersTable.parentElement).toHaveClass(
      "overflow-x-auto",
      "overscroll-x-contain",
    );
    expect(customersTable).toHaveClass("min-w-[900px]");
    expect(customersTable).toHaveClass("responsive-data-table");
    expect(
      customersTable.querySelector('[data-label="Email"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toHaveClass(
      "sticky",
    );
    expect(screen.getByText("CUST-001")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View" }));
    expect(
      await screen.findByRole("heading", { name: "Customer Detail" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("contact@maju.test").length).toBeGreaterThan(1);
  });

  it("allows SALES_STAFF to create and update customers", async () => {
    const user = userEvent.setup();
    const handlers = installCustomerHandlers();
    renderWithProviders(<CustomersPage />, "SALES_STAFF");

    await screen.findByText("PT Maju Jaya");
    await user.click(screen.getByRole("button", { name: "Add Customer" }));
    await user.type(screen.getByLabelText("Customer Code"), "CUST-002");
    await user.type(screen.getByLabelText("Customer Name"), "PT Baru");
    await user.click(screen.getByRole("button", { name: "Create Customer" }));

    await waitFor(() => expect(handlers.getMutationCount()).toBe(1));
    const successMessage = await screen.findByRole("status");
    expect(successMessage).toHaveAttribute("aria-live", "polite");
    expect(successMessage).toHaveTextContent("Customer saved successfully.");
  });

  it("keeps WAREHOUSE_STAFF read-only", async () => {
    installCustomerHandlers();
    renderWithProviders(<CustomersPage />, "WAREHOUSE_STAFF");

    expect(await screen.findByText("PT Maju Jaya")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add Customer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit PT Maju Jaya" }),
    ).not.toBeInTheDocument();
  });
});
