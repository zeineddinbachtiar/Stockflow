import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import CategoriesPage from "./CategoriesPage";

import type {
  Category,
  CategoryPayload,
} from "../features/categories/category.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const category: Category = {
  id: "category-001",
  name: "Computers",
  description: "Computer products",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const success = <T,>(data: T) => ({
  status: "success" as const,
  data,
});

function installCategoryHandlers(initial: Category[] = [category]) {
  const records = [...initial];

  server.use(
    http.get(`${API_URL}/categories`, ({ request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const offset = Number(url.searchParams.get("offset") ?? 0);

      const active = records.filter((item) => item.isActive);

      return HttpResponse.json(
        success({
          categories: active.slice(offset, offset + limit),
          total: active.length,
          limit,
          offset,
        }),
      );
    }),

    http.post(`${API_URL}/categories`, async ({ request }) => {
      const payload = (await request.json()) as CategoryPayload;

      const created: Category = {
        ...category,
        id: "category-new",
        ...payload,
      };

      records.push(created);

      return HttpResponse.json(success({ category: created }), { status: 201 });
    }),

    http.patch(`${API_URL}/categories/:id`, async ({ params, request }) => {
      const payload = (await request.json()) as Partial<CategoryPayload>;
      const index = records.findIndex((item) => item.id === params.id);

      if (index === -1) {
        return HttpResponse.json(
          { message: "Category not found." },
          { status: 404 },
        );
      }

      const current = records[index]!;

      const updated: Category = {
        ...current,
        ...payload,
        updatedAt: "2026-02-01T00:00:00.000Z",
      };

      records[index] = updated;

      return HttpResponse.json(success({ category: updated }));
    }),

    http.patch(`${API_URL}/categories/:id/deactivate`, ({ params }) => {
      const index = records.findIndex((item) => item.id === params.id);

      if (index === -1) {
        return HttpResponse.json(
          { message: "Category not found." },
          { status: 404 },
        );
      }

      const updated = {
        ...records[index]!,
        isActive: false,
      };

      records[index] = updated;

      return HttpResponse.json(success({ category: updated }));
    }),
  );
}

describe("CategoriesPage", () => {
  it("loads categories and displays ADMIN actions", async () => {
    installCategoryHandlers();

    renderWithProviders(<CategoriesPage />);

    expect(await screen.findByText("Computers")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Add Category" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Edit Computers" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Deactivate Computers",
      }),
    ).toBeInTheDocument();
  });

  it.each(["WAREHOUSE_STAFF", "SALES_STAFF"] as const)(
    "%s cannot see category mutation actions",
    async (role) => {
      installCategoryHandlers();

      renderWithProviders(<CategoriesPage />, role);

      expect(await screen.findByText("Computers")).toBeInTheDocument();

      expect(
        screen.queryByRole("button", { name: "Add Category" }),
      ).not.toBeInTheDocument();

      expect(
        screen.queryByRole("button", { name: "Edit Computers" }),
      ).not.toBeInTheDocument();

      expect(
        screen.queryByRole("button", {
          name: "Deactivate Computers",
        }),
      ).not.toBeInTheDocument();
    },
  );

  it("creates a category and refreshes the catalog", async () => {
    const user = userEvent.setup();
    installCategoryHandlers();

    renderWithProviders(<CategoriesPage />);

    await screen.findByText("Computers");

    await user.click(screen.getByRole("button", { name: "Add Category" }));

    await user.type(screen.getByLabelText("Category Name"), "Storage");

    await user.click(screen.getByRole("button", { name: "Create Category" }));

    expect(await screen.findByText("Storage")).toBeInTheDocument();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits an existing category", async () => {
    const user = userEvent.setup();
    installCategoryHandlers();

    renderWithProviders(<CategoriesPage />);

    await screen.findByText("Computers");

    await user.click(screen.getByRole("button", { name: "Edit Computers" }));

    const nameInput = screen.getByLabelText("Category Name");

    await user.clear(nameInput);
    await user.type(nameInput, "Office Equipment");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Office Equipment")).toBeInTheDocument();
  });

  it("deactivates a category after confirmation", async () => {
    const user = userEvent.setup();
    installCategoryHandlers();

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithProviders(<CategoriesPage />);

    await screen.findByText("Computers");

    await user.click(
      screen.getByRole("button", {
        name: "Deactivate Computers",
      }),
    );

    expect(window.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.queryByText("Computers")).not.toBeInTheDocument();
    });

    expect(screen.getByText("No categories found")).toBeInTheDocument();
  });

  it("does not deactivate when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    installCategoryHandlers();

    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithProviders(<CategoriesPage />);

    await screen.findByText("Computers");

    await user.click(
      screen.getByRole("button", {
        name: "Deactivate Computers",
      }),
    );

    expect(await screen.findByText("Computers")).toBeInTheDocument();
  });

  it("supports pagination", async () => {
    const user = userEvent.setup();

    const records = Array.from({ length: 11 }, (_, index) => ({
      ...category,
      id: `category-${index + 1}`,
      name: `Category ${index + 1}`,
    }));

    installCategoryHandlers(records);

    renderWithProviders(<CategoriesPage />);

    expect(await screen.findByText("Category 1")).toBeInTheDocument();

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Category 11")).toBeInTheDocument();

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("displays an API error when categories cannot load", async () => {
    server.use(
      http.get(`${API_URL}/categories`, () =>
        HttpResponse.json(
          { message: "Database unavailable." },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<CategoriesPage />);

    expect(
      await screen.findByText("Unable to load categories"),
    ).toBeInTheDocument();

    expect(screen.getByText("Database unavailable.")).toBeInTheDocument();
  });
});
