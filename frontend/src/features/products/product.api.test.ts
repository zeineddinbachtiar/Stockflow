import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import {
  createProduct,
  deactivateProduct,
  getProductById,
  getProducts,
  reactivateProduct,
  updateProduct,
} from "./product.api";
import type { Product } from "./product.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const TOKEN = "test-access-token";

const product: Product = {
  id: "product-001",
  categoryId: "category-001",
  sku: "LAP-001",
  name: "Business Laptop",
  description: "14-inch laptop",
  unitPrice: "14999000.00",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const envelope = <T>(data: T) => ({
  status: "success" as const,
  data,
});

describe("Product API", () => {
  it("gets products with pagination, search and authorization", async () => {
    let receivedAuthorization: string | null = null;
    let receivedSearch: string | null = null;

    server.use(
      http.get(`${API_URL}/products`, ({ request }) => {
        const url = new URL(request.url);

        receivedAuthorization = request.headers.get("Authorization");
        receivedSearch = url.searchParams.get("search");

        expect(url.searchParams.get("categoryId")).toBe("category-001");
        expect(url.searchParams.get("limit")).toBe("10");
        expect(url.searchParams.get("offset")).toBe("0");

        return HttpResponse.json(
          envelope({
            products: [product],
            total: 1,
            limit: 10,
            offset: 0,
          }),
        );
      }),
    );

    const result = await getProducts(TOKEN, {
      categoryId: "category-001",
      search: " LAP-001 ",
      limit: 10,
      offset: 0,
    });

    expect(receivedAuthorization).toBe(`Bearer ${TOKEN}`);
    expect(receivedSearch).toBe("LAP-001");
    expect(result.products).toEqual([product]);
    expect(result.total).toBe(1);
  });

  it("gets product details by ID", async () => {
    server.use(
      http.get(`${API_URL}/products/:id`, ({ params }) => {
        expect(params.id).toBe("product-001");

        return HttpResponse.json(envelope({ product }));
      }),
    );

    const result = await getProductById(TOKEN, product.id);

    expect(result).toEqual(product);
  });

  it("creates a product", async () => {
    let receivedBody: unknown;

    server.use(
      http.post(`${API_URL}/products`, async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json(envelope({ product }), { status: 201 });
      }),
    );

    const payload = {
      categoryId: "category-001",
      sku: "LAP-001",
      name: "Business Laptop",
      description: "14-inch laptop",
      unitPrice: "14999000.00",
    };

    const result = await createProduct(TOKEN, payload);

    expect(receivedBody).toEqual(payload);
    expect(result).toEqual(product);
  });

  it("updates a product", async () => {
    let receivedBody: unknown;

    server.use(
      http.patch(`${API_URL}/products/:id`, async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json(
          envelope({
            product: {
              ...product,
              name: "Updated Laptop",
            },
          }),
        );
      }),
    );

    const result = await updateProduct(TOKEN, product.id, {
      name: "Updated Laptop",
    });

    expect(receivedBody).toEqual({
      name: "Updated Laptop",
    });

    expect(result.name).toBe("Updated Laptop");
  });

  it("deactivates a product", async () => {
    server.use(
      http.patch(`${API_URL}/products/:id/deactivate`, () => {
        return HttpResponse.json(
          envelope({
            product: {
              ...product,
              isActive: false,
            },
          }),
        );
      }),
    );

    const result = await deactivateProduct(TOKEN, product.id);

    expect(result.isActive).toBe(false);
  });

  it("reactivates a product", async () => {
    server.use(
      http.patch(`${API_URL}/products/:id/reactivate`, ({ params }) => {
        expect(params.id).toBe(product.id);
        return HttpResponse.json(
          envelope({
            product: {
              ...product,
              isActive: true,
            },
          }),
        );
      }),
    );

    await expect(reactivateProduct(TOKEN, product.id)).resolves.toMatchObject({
      isActive: true,
    });
  });
});
