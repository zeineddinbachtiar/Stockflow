import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import type { Category } from "../features/categories/category.types";
import type { Product } from "../features/products/product.types";
import CategoryDetailPage from "./CategoryDetailPage";

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

const product: Product = {
  id: "product-001",
  categoryId: category.id,
  sku: "LAP-001",
  name: "Business Laptop",
  description: "14-inch laptop",
  unitPrice: "14999000.00",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const success = <T,>(data: T) => ({
  status: "success" as const,
  data,
});

function renderCategoryDetail() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/categories/${category.id}`]}>
      <Routes>
        <Route path="/categories" element={<h1>Category catalog</h1>} />
        <Route path="/categories/:id" element={<CategoryDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function installCategoryHandler() {
  server.use(
    http.get(`${API_URL}/categories/:id`, ({ params }) => {
      expect(params.id).toBe(category.id);
      return HttpResponse.json(success({ category }));
    }),
  );
}

describe("CategoryDetailPage", () => {
  it("shows filtered category products and returns to the category list", async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 11 }, (_, index) => ({
      ...product,
      id: `product-${index + 1}`,
      sku: `SKU-${index + 1}`,
      name: `Widget ${index + 1}`,
    }));
    let receivedCategoryId: string | null = null;
    let receivedSearch: string | null = null;

    installCategoryHandler();
    server.use(
      http.get(`${API_URL}/products`, ({ request }) => {
        const url = new URL(request.url);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? 10);
        const search = url.searchParams.get("search")?.toLowerCase() ?? "";

        receivedCategoryId = url.searchParams.get("categoryId");
        receivedSearch = url.searchParams.get("search");

        const filtered = records.filter((item) =>
          item.name.toLowerCase().includes(search),
        );

        return HttpResponse.json(
          success({
            products: filtered.slice(offset, offset + limit),
            total: filtered.length,
            limit,
            offset,
          }),
        );
      }),
    );

    renderCategoryDetail();

    expect(
      await screen.findByRole("heading", { name: "Computers" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Widget 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(receivedCategoryId).toBe(category.id);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Widget 11")).toBeInTheDocument();

    const searchBox = screen.getByRole("searchbox", {
      name: "Search products in category",
    });
    await user.type(searchBox, "Widget 3");
    await waitFor(() => {
      expect(receivedSearch).toBe("Widget 3");
      expect(screen.getByText("Widget 3")).toBeInTheDocument();
      expect(screen.queryByText("Widget 11")).not.toBeInTheDocument();
    });
    expect(receivedCategoryId).toBe(category.id);
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Back to categories" }));
    expect(
      await screen.findByRole("heading", { name: "Category catalog" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when a category has no active products", async () => {
    installCategoryHandler();
    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json(
          success({
            products: [],
            total: 0,
            limit: 10,
            offset: 0,
          }),
        ),
      ),
    );

    renderCategoryDetail();

    expect(
      await screen.findByText("No products in this category"),
    ).toBeInTheDocument();
  });

  it("retries a failed product request", async () => {
    const user = userEvent.setup();
    let requestCount = 0;

    installCategoryHandler();
    server.use(
      http.get(`${API_URL}/products`, () => {
        requestCount += 1;
        if (requestCount === 1) {
          return HttpResponse.json(
            {
              status: "error",
              code: "SERVICE_UNAVAILABLE",
              message: "Product service is temporarily unavailable.",
            },
            { status: 503 },
          );
        }

        return HttpResponse.json(
          success({
            products: [product],
            total: 1,
            limit: 10,
            offset: 0,
          }),
        );
      }),
    );

    renderCategoryDetail();

    expect(
      await screen.findByText("Unable to load category products"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(product.name)).toBeInTheDocument();
    expect(requestCount).toBe(2);
  });

  it("shows not found for a missing category without requesting products", async () => {
    let productRequestCount = 0;
    server.use(
      http.get(`${API_URL}/categories/:id`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "CATEGORY_NOT_FOUND",
            message: "Category not found.",
          },
          { status: 404 },
        ),
      ),
      http.get(`${API_URL}/products`, () => {
        productRequestCount += 1;
        return HttpResponse.json(
          success({ products: [], total: 0, limit: 10, offset: 0 }),
        );
      }),
    );

    renderCategoryDetail();

    expect(await screen.findByText("Category not found")).toBeInTheDocument();
    expect(
      screen.getByText("This category does not exist or is inactive."),
    ).toBeInTheDocument();
    expect(productRequestCount).toBe(0);
  });
});
