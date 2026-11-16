import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import ProductsPage from "./ProductsPage";

import type { Category, Product } from "../features/products/product.types";

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

function installProductHandlers(initial: Product[] = [product]) {
  const records = [...initial];
  server.use(
    http.get(`${API_URL}/categories`, () =>
      HttpResponse.json(
        success({
          categories: [category],
          total: 1,
          limit: 100,
          offset: 0,
        }),
      ),
    ),

    http.get(`${API_URL}/products`, ({ request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const search = url.searchParams.get("search")?.toLowerCase() ?? "";

      const filtered = records.filter(
        (item) =>
          item.isActive &&
          (!search ||
            item.name.toLowerCase().includes(search) ||
            item.sku.toLowerCase().includes(search)),
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

    http.get(`${API_URL}/products/:id`, ({ params }) => {
      const found = records.find((item) => item.id === params.id);

      if (!found) {
        return HttpResponse.json(
          { message: "Product not found." },
          { status: 404 },
        );
      }

      return HttpResponse.json(success({ product: found }));
    }),

    http.post(`${API_URL}/products`, async ({ request }) => {
      const payload = (await request.json()) as Omit<
        Product,
        "id" | "isActive" | "createdAt" | "updatedAt"
      >;

      const created: Product = {
        ...product,
        ...payload,
        id: "product-new",
      };

      records.push(created);

      return HttpResponse.json(success({ product: created }), { status: 201 });
    }),

    http.patch(`${API_URL}/products/:id`, async ({ params, request }) => {
      const payload = (await request.json()) as Partial<Product>;
      const index = records.findIndex((item) => item.id === params.id);

      if (index === -1) {
        return HttpResponse.json(
          { message: "Product not found." },
          { status: 404 },
        );
      }

      const updated: Product = {
        ...records[index]!,
        ...payload,
        updatedAt: "2026-02-01T00:00:00.000Z",
      };

      records[index] = updated;

      return HttpResponse.json(success({ product: updated }));
    }),

    http.patch(`${API_URL}/products/:id/deactivate`, ({ params }) => {
      const index = records.findIndex((item) => item.id === params.id);

      if (index === -1) {
        return HttpResponse.json(
          { message: "Product not found." },
          { status: 404 },
        );
      }

      const updated = {
        ...records[index]!,
        isActive: false,
      };

      records[index] = updated;

      return HttpResponse.json(success({ product: updated }));
    }),
  );
}

describe("ProductsPage", () => {
  it("loads products and displays ADMIN actions", async () => {
    installProductHandlers();

    renderWithProviders(<ProductsPage />);

    expect(await screen.findByText("Business Laptop")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Add Product" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Edit Business Laptop" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Deactivate Business Laptop",
      }),
    ).toBeInTheDocument();
  });

  it.each(["WAREHOUSE_STAFF", "SALES_STAFF"] as const)(
    "%s cannot see product mutation actions",
    async (role) => {
      installProductHandlers();

      renderWithProviders(<ProductsPage />, role);

      expect(await screen.findByText("Business Laptop")).toBeInTheDocument();

      expect(
        screen.queryByRole("button", { name: "Add Product" }),
      ).not.toBeInTheDocument();

      expect(
        screen.queryByRole("button", {
          name: "Edit Business Laptop",
        }),
      ).not.toBeInTheDocument();

      expect(
        screen.queryByRole("button", {
          name: "Deactivate Business Laptop",
        }),
      ).not.toBeInTheDocument();
    },
  );

  it("creates a product and refreshes the catalog", async () => {
    const user = userEvent.setup();
    installProductHandlers();

    renderWithProviders(<ProductsPage />);

    await screen.findByText("Business Laptop");

    await user.click(screen.getByRole("button", { name: "Add Product" }));

    await user.selectOptions(screen.getByLabelText("Category"), category.id);

    await user.type(screen.getByLabelText("SKU"), "LAP-002");

    await user.type(screen.getByLabelText("Product Name"), "New Laptop");

    await user.type(screen.getByLabelText("Unit Price"), "12000000.00");

    await user.click(screen.getByRole("button", { name: "Create Product" }));

    expect(await screen.findByText("New Laptop")).toBeInTheDocument();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits an existing product", async () => {
    const user = userEvent.setup();
    installProductHandlers();

    renderWithProviders(<ProductsPage />);

    await screen.findByText("Business Laptop");

    await user.click(
      screen.getByRole("button", {
        name: "Edit Business Laptop",
      }),
    );

    const nameInput = screen.getByLabelText("Product Name");

    await user.clear(nameInput);
    await user.type(nameInput, "Updated Business Laptop");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      await screen.findByText("Updated Business Laptop"),
    ).toBeInTheDocument();
  });

  it("deactivates a product after confirmation", async () => {
    const user = userEvent.setup();
    installProductHandlers();

    renderWithProviders(<ProductsPage />);

    await screen.findByText("Business Laptop");

    await user.click(
      screen.getByRole("button", {
        name: "Deactivate Business Laptop",
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "Deactivate product" }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Business Laptop")).not.toBeInTheDocument();
    });

    expect(screen.getByText("No products found")).toBeInTheDocument();
  });

  it("does not deactivate when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    installProductHandlers();

    renderWithProviders(<ProductsPage />);

    await screen.findByText("Business Laptop");

    await user.click(
      screen.getByRole("button", {
        name: "Deactivate Business Laptop",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Business Laptop")).toBeInTheDocument();
  });

  it("opens product details", async () => {
    const user = userEvent.setup();
    installProductHandlers();

    renderWithProviders(<ProductsPage />);

    await screen.findByText("Business Laptop");

    await user.click(
      screen.getByRole("button", {
        name: "View Business Laptop details",
      }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    expect(screen.getByText("Product ID: product-001")).toBeInTheDocument();
  });

  it("searches products by name or SKU", async () => {
    const user = userEvent.setup();

    installProductHandlers([
      product,
      {
        ...product,
        id: "product-002",
        sku: "MOU-001",
        name: "Wireless Mouse",
      },
    ]);

    renderWithProviders(<ProductsPage />);

    await screen.findByText("Business Laptop");
    expect(screen.getByText("Wireless Mouse")).toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", {
        name: "Search products by name or SKU",
      }),
      "WIRELESS",
    );

    await waitFor(() => {
      expect(screen.getByText("Wireless Mouse")).toBeInTheDocument();
      expect(screen.queryByText("Business Laptop")).not.toBeInTheDocument();
    });
  });

  it("supports pagination", async () => {
    const user = userEvent.setup();

    const records = Array.from({ length: 11 }, (_, index) => ({
      ...product,
      id: `product-${index + 1}`,
      sku: `SKU-${index + 1}`,
      name: `Product ${index + 1}`,
    }));

    installProductHandlers(records);

    renderWithProviders(<ProductsPage />);

    expect(await screen.findByText("Product 1")).toBeInTheDocument();

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Product 11")).toBeInTheDocument();

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("displays an API error when products cannot load", async () => {
    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json(
          { message: "Product service unavailable." },
          { status: 503 },
        ),
      ),
    );

    installProductHandlers();

    // Override the product endpoint after registering the other handlers.
    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json(
          { message: "Product service unavailable." },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<ProductsPage />);

    expect(
      await screen.findByText("Unable to load products"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Product service unavailable."),
    ).toBeInTheDocument();
  });

  it("displays API errors when product creation fails", async () => {
    const user = userEvent.setup();

    installProductHandlers();

    server.use(
      http.post(`${API_URL}/products`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "DUPLICATE_RESOURCE",
            message: "Product SKU already exists.",
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<ProductsPage />);

    await screen.findByText("Business Laptop");

    await user.click(screen.getByRole("button", { name: "Add Product" }));

    await user.selectOptions(screen.getByLabelText("Category"), category.id);

    await user.type(screen.getByLabelText("SKU"), "LAP-001");

    await user.type(screen.getByLabelText("Product Name"), "Duplicate Laptop");

    await user.type(screen.getByLabelText("Unit Price"), "12000000.00");

    await user.click(screen.getByRole("button", { name: "Create Product" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Product SKU already exists.",
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    expect(screen.getByLabelText("SKU")).toHaveValue("LAP-001");
  });

  it("displays and dismisses product deactivation errors", async () => {
    const user = userEvent.setup();

    installProductHandlers();

    server.use(
      http.patch(`${API_URL}/products/:id/deactivate`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "RELATED_RESOURCE_CONFLICT",
            message: "Product cannot be deactivated.",
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<ProductsPage />);

    await screen.findByText("Business Laptop");

    await user.click(
      screen.getByRole("button", {
        name: "Deactivate Business Laptop",
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "Deactivate product" }),
    );

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("Unable to deactivate product");

    expect(alert).toHaveTextContent("Product cannot be deactivated.");

    await user.click(screen.getByRole("button", { name: "Dismiss error" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    expect(screen.getByText("Business Laptop")).toBeInTheDocument();
  });

  it("retries loading products after an initial API failure", async () => {
    const user = userEvent.setup();

    let requestCount = 0;

    installProductHandlers();

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

    renderWithProviders(<ProductsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Product service is temporarily unavailable.",
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Business Laptop")).toBeInTheDocument();

    expect(requestCount).toBe(2);

    expect(
      screen.queryByText("Unable to load products"),
    ).not.toBeInTheDocument();
  });

  it("retries loading product details after an initial API failure", async () => {
    const user = userEvent.setup();

    let detailRequestCount = 0;

    installProductHandlers();

    server.use(
      http.get(`${API_URL}/products/:id`, () => {
        detailRequestCount += 1;

        if (detailRequestCount === 1) {
          return HttpResponse.json(
            {
              status: "error",
              code: "SERVICE_UNAVAILABLE",
              message: "Product detail service is unavailable.",
            },
            { status: 503 },
          );
        }

        return HttpResponse.json(success({ product }));
      }),
    );

    renderWithProviders(<ProductsPage />);

    await screen.findByText("Business Laptop");

    await user.click(
      screen.getByRole("button", {
        name: "View Business Laptop details",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load product details.",
    );

    expect(
      screen.getByText("Product detail service is unavailable."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByText("Product ID: product-001"),
    ).toBeInTheDocument();

    expect(detailRequestCount).toBe(2);
  });
});
