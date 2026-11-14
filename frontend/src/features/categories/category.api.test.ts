import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import {
  createCategory,
  deactivateCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "./category.api";
import type { Category } from "./category.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const TOKEN = "test-access-token";

const category: Category = {
  id: "category-001",
  name: "Computers",
  description: "Computer products",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const envelope = <T>(data: T) => ({
  status: "success" as const,
  data,
});

describe("Category API", () => {
  it("gets categories with pagination", async () => {
    let receivedAuthorization: string | null = null;

    server.use(
      http.get(`${API_URL}/categories`, ({ request }) => {
        const url = new URL(request.url);

        receivedAuthorization = request.headers.get("Authorization");

        expect(url.searchParams.get("limit")).toBe("10");
        expect(url.searchParams.get("offset")).toBe("0");

        return HttpResponse.json(
          envelope({
            categories: [category],
            total: 1,
            limit: 10,
            offset: 0,
          }),
        );
      }),
    );

    const result = await getCategories(TOKEN, 10, 0);

    expect(receivedAuthorization).toBe(`Bearer ${TOKEN}`);
    expect(result.categories).toEqual([category]);
    expect(result.total).toBe(1);
  });

  it("gets category details by ID", async () => {
    server.use(
      http.get(`${API_URL}/categories/:id`, () => {
        return HttpResponse.json(envelope({ category }));
      }),
    );

    const result = await getCategoryById(TOKEN, category.id);

    expect(result).toEqual(category);
  });

  it("creates a category", async () => {
    let receivedBody: unknown;

    server.use(
      http.post(`${API_URL}/categories`, async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json(envelope({ category }), { status: 201 });
      }),
    );

    const payload = {
      name: "Computers",
      description: "Computer products",
    };

    const result = await createCategory(TOKEN, payload);

    expect(receivedBody).toEqual(payload);
    expect(result).toEqual(category);
  });

  it("updates a category", async () => {
    let receivedBody: unknown;

    server.use(
      http.patch(`${API_URL}/categories/:id`, async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json(
          envelope({
            category: {
              ...category,
              name: "Office Equipment",
            },
          }),
        );
      }),
    );

    const result = await updateCategory(TOKEN, category.id, {
      name: "Office Equipment",
    });

    expect(receivedBody).toEqual({
      name: "Office Equipment",
    });

    expect(result.name).toBe("Office Equipment");
  });

  it("deactivates a category", async () => {
    server.use(
      http.patch(`${API_URL}/categories/:id/deactivate`, () => {
        return HttpResponse.json(
          envelope({
            category: {
              ...category,
              isActive: false,
            },
          }),
        );
      }),
    );

    const result = await deactivateCategory(TOKEN, category.id);

    expect(result.isActive).toBe(false);
  });
});
