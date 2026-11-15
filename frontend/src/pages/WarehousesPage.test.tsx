import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import WarehousesPage from "./WarehousesPage";

import type {
  Warehouse,
  WarehousePayload,
} from "../features/warehouses/warehouse.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const warehouse: Warehouse = {
  id: "warehouse-001",
  code: "WH-JKT",
  name: "Jakarta Central Warehouse",
  address: "Central Jakarta",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const success = <T,>(data: T) => ({
  status: "success" as const,
  data,
});

function installWarehouseHandlers(initial: Warehouse[] = [warehouse]) {
  const records = initial.map((item) => ({ ...item }));

  server.use(
    http.get(`${API_URL}/warehouses`, ({ request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const active = records.filter((item) => item.isActive);

      return HttpResponse.json(
        success({
          warehouses: active.slice(offset, offset + limit),
          total: active.length,
          limit,
          offset,
        }),
      );
    }),

    http.post(`${API_URL}/warehouses`, async ({ request }) => {
      const payload = (await request.json()) as WarehousePayload;

      const created: Warehouse = {
        ...warehouse,
        ...payload,
        id: "warehouse-new",
        isActive: true,
      };

      records.push(created);

      return HttpResponse.json(success({ warehouse: created }), {
        status: 201,
      });
    }),

    http.patch(`${API_URL}/warehouses/:id`, async ({ params, request }) => {
      const payload = (await request.json()) as Partial<WarehousePayload>;
      const index = records.findIndex((item) => item.id === params.id);

      if (index === -1) {
        return HttpResponse.json(
          { message: "Warehouse not found." },
          { status: 404 },
        );
      }

      const updated: Warehouse = {
        ...records[index]!,
        ...payload,
        updatedAt: "2026-02-01T00:00:00.000Z",
      };

      records[index] = updated;

      return HttpResponse.json(success({ warehouse: updated }));
    }),

    http.patch(`${API_URL}/warehouses/:id/deactivate`, ({ params }) => {
      const index = records.findIndex((item) => item.id === params.id);

      if (index === -1) {
        return HttpResponse.json(
          { message: "Warehouse not found." },
          { status: 404 },
        );
      }

      const updated: Warehouse = {
        ...records[index]!,
        isActive: false,
      };

      records[index] = updated;

      return HttpResponse.json(success({ warehouse: updated }));
    }),
  );

  return records;
}

describe("WarehousesPage", () => {
  it("loads warehouses and displays ADMIN management actions", async () => {
    installWarehouseHandlers();

    renderWithProviders(<WarehousesPage />);

    expect(
      await screen.findByText("Jakarta Central Warehouse"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Add Warehouse" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Edit Jakarta Central Warehouse",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Deactivate Jakarta Central Warehouse",
      }),
    ).toBeInTheDocument();
  });

  it.each(["WAREHOUSE_STAFF", "SALES_STAFF"] as const)(
    "%s can read warehouses but cannot see management actions",
    async (role) => {
      installWarehouseHandlers();

      renderWithProviders(<WarehousesPage />, role);

      expect(
        await screen.findByText("Jakarta Central Warehouse"),
      ).toBeInTheDocument();

      expect(
        screen.queryByRole("button", { name: "Add Warehouse" }),
      ).not.toBeInTheDocument();

      expect(
        screen.queryByRole("button", {
          name: "Edit Jakarta Central Warehouse",
        }),
      ).not.toBeInTheDocument();

      expect(
        screen.queryByRole("button", {
          name: "Deactivate Jakarta Central Warehouse",
        }),
      ).not.toBeInTheDocument();
    },
  );

  it("creates a warehouse and refreshes the directory", async () => {
    const user = userEvent.setup();
    installWarehouseHandlers();

    renderWithProviders(<WarehousesPage />);

    await screen.findByText("Jakarta Central Warehouse");

    await user.click(screen.getByRole("button", { name: "Add Warehouse" }));

    await user.type(screen.getByLabelText("Warehouse Code"), "WH-SBY");

    await user.type(
      screen.getByLabelText("Warehouse Name"),
      "Surabaya Distribution Center",
    );

    await user.click(screen.getByRole("button", { name: "Create Warehouse" }));

    expect(
      await screen.findByText("Surabaya Distribution Center"),
    ).toBeInTheDocument();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits an existing warehouse", async () => {
    const user = userEvent.setup();
    installWarehouseHandlers();

    renderWithProviders(<WarehousesPage />);

    await screen.findByText("Jakarta Central Warehouse");

    await user.click(
      screen.getByRole("button", {
        name: "Edit Jakarta Central Warehouse",
      }),
    );

    const nameInput = screen.getByLabelText("Warehouse Name");

    await user.clear(nameInput);
    await user.type(nameInput, "Jakarta Main Warehouse");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      await screen.findByText("Jakarta Main Warehouse"),
    ).toBeInTheDocument();
  });

  it("deactivates a warehouse only after confirmation", async () => {
    const user = userEvent.setup();

    installWarehouseHandlers();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithProviders(<WarehousesPage />);

    await screen.findByText("Jakarta Central Warehouse");

    await user.click(
      screen.getByRole("button", {
        name: "Deactivate Jakarta Central Warehouse",
      }),
    );

    expect(window.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(
        screen.queryByText("Jakarta Central Warehouse"),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText("No warehouses found")).toBeInTheDocument();
  });

  it("keeps the warehouse active when deactivation is cancelled", async () => {
    const user = userEvent.setup();

    installWarehouseHandlers();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithProviders(<WarehousesPage />);

    await screen.findByText("Jakarta Central Warehouse");

    await user.click(
      screen.getByRole("button", {
        name: "Deactivate Jakarta Central Warehouse",
      }),
    );

    expect(screen.getByText("Jakarta Central Warehouse")).toBeInTheDocument();
  });

  it("supports pagination", async () => {
    const user = userEvent.setup();

    const records = Array.from({ length: 11 }, (_, index) => ({
      ...warehouse,
      id: `warehouse-${index + 1}`,
      code: `WH-${index + 1}`,
      name: `Warehouse ${index + 1}`,
    }));

    installWarehouseHandlers(records);

    renderWithProviders(<WarehousesPage />);

    expect(await screen.findByText("Warehouse 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Warehouse 11")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("displays an API error when warehouses cannot load", async () => {
    server.use(
      http.get(`${API_URL}/warehouses`, () =>
        HttpResponse.json(
          { message: "Database unavailable." },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<WarehousesPage />);

    expect(
      await screen.findByText("Unable to load warehouses"),
    ).toBeInTheDocument();

    expect(screen.getByText("Database unavailable.")).toBeInTheDocument();
  });

  it("displays an error when warehouse deactivation fails", async () => {
    const user = userEvent.setup();

    installWarehouseHandlers();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    server.use(
      http.patch(`${API_URL}/warehouses/:id/deactivate`, () =>
        HttpResponse.json(
          { message: "Warehouse cannot be deactivated." },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<WarehousesPage />);

    await screen.findByText("Jakarta Central Warehouse");

    await user.click(
      screen.getByRole("button", {
        name: "Deactivate Jakarta Central Warehouse",
      }),
    );

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("Unable to deactivate warehouse");
    expect(alert).toHaveTextContent("Warehouse cannot be deactivated.");
  });

  it("displays an empty state when no active warehouses exist", async () => {
    installWarehouseHandlers([]);

    renderWithProviders(<WarehousesPage />);

    expect(await screen.findByText("No warehouses found")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first warehouse to get started."),
    ).toBeInTheDocument();
  });
});
