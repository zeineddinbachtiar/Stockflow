import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest, registerAuthSessionHandlers } from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("apiRequest authentication handling", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refreshes an expired access token and retries the original request", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            status: "error",
            code: "INVALID_ACCESS_TOKEN",
            message: "Access token is invalid or expired.",
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: "success",
          data: { products: [] },
        }),
      );

    const refreshAccessToken = vi
      .fn()
      .mockResolvedValue("refreshed-access-token");
    const onSessionExpired = vi.fn();
    const unregister = registerAuthSessionHandlers({
      refreshAccessToken,
      onSessionExpired,
    });

    try {
      const result = await apiRequest<{
        status: string;
        data: { products: unknown[] };
      }>("/products", {}, "expired-access-token");

      expect(result.data.products).toEqual([]);
      expect(refreshAccessToken).toHaveBeenCalledOnce();
      expect(refreshAccessToken).toHaveBeenCalledWith("expired-access-token");
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const firstHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
      const secondHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);

      expect(firstHeaders.get("Authorization")).toBe(
        "Bearer expired-access-token",
      );
      expect(secondHeaders.get("Authorization")).toBe(
        "Bearer refreshed-access-token",
      );
      expect(onSessionExpired).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it("does not refresh when a public request receives HTTP 401", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          status: "error",
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
        401,
      ),
    );

    const refreshAccessToken = vi.fn();
    const onSessionExpired = vi.fn();
    const unregister = registerAuthSessionHandlers({
      refreshAccessToken,
      onSessionExpired,
    });

    try {
      await expect(
        apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: "invalid@example.com",
            password: "invalid-password",
          }),
        }),
      ).rejects.toMatchObject({
        status: 401,
        code: "INVALID_CREDENTIALS",
      });

      expect(refreshAccessToken).not.toHaveBeenCalled();
      expect(onSessionExpired).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      unregister();
    }
  });

  it("ends the session when the refresh token is rejected", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          status: "error",
          code: "INVALID_ACCESS_TOKEN",
          message: "Access token is invalid or expired.",
        },
        401,
      ),
    );

    const refreshAccessToken = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          "Refresh token is invalid, expired, or revoked.",
          401,
          "INVALID_REFRESH_TOKEN",
        ),
      );
    const onSessionExpired = vi.fn();
    const unregister = registerAuthSessionHandlers({
      refreshAccessToken,
      onSessionExpired,
    });

    try {
      await expect(
        apiRequest("/products", {}, "expired-access-token"),
      ).rejects.toMatchObject({
        status: 401,
        code: "INVALID_REFRESH_TOKEN",
      });

      expect(refreshAccessToken).toHaveBeenCalledOnce();
      expect(onSessionExpired).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      unregister();
    }
  });

  it("preserves network errors from refresh instead of reporting the original 401", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "INVALID_ACCESS_TOKEN" }, 401),
    );

    const refreshAccessToken = vi
      .fn()
      .mockRejectedValue(
        new ApiError("Network unavailable.", 0, "NETWORK_ERROR"),
      );
    const onSessionExpired = vi.fn();
    const unregister = registerAuthSessionHandlers({
      refreshAccessToken,
      onSessionExpired,
    });

    try {
      await expect(
        apiRequest("/products", {}, "expired-access-token"),
      ).rejects.toMatchObject({
        status: 0,
        code: "NETWORK_ERROR",
      });
      expect(onSessionExpired).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it("preserves server errors from refresh instead of reporting the original 401", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "INVALID_ACCESS_TOKEN" }, 401),
    );

    const refreshAccessToken = vi
      .fn()
      .mockRejectedValue(
        new ApiError("Try again later.", 503, "AUTH_SERVICE_UNAVAILABLE"),
      );
    const onSessionExpired = vi.fn();
    const unregister = registerAuthSessionHandlers({
      refreshAccessToken,
      onSessionExpired,
    });

    try {
      await expect(
        apiRequest("/products", {}, "expired-access-token"),
      ).rejects.toMatchObject({
        status: 503,
        code: "AUTH_SERVICE_UNAVAILABLE",
      });
      expect(onSessionExpired).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it("shares one refresh operation between concurrent requests", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ code: "INVALID_ACCESS_TOKEN" }, 401),
      )
      .mockResolvedValueOnce(
        jsonResponse({ code: "INVALID_ACCESS_TOKEN" }, 401),
      )
      .mockResolvedValueOnce(
        jsonResponse({ status: "success", data: { products: [] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ status: "success", data: { warehouses: [] } }),
      );

    const refreshAccessToken = vi
      .fn()
      .mockResolvedValue("refreshed-access-token");
    const onSessionExpired = vi.fn();
    const unregister = registerAuthSessionHandlers({
      refreshAccessToken,
      onSessionExpired,
    });

    try {
      const [products, warehouses] = await Promise.all([
        apiRequest<{ data: { products: unknown[] } }>(
          "/products",
          {},
          "expired-access-token",
        ),
        apiRequest<{ data: { warehouses: unknown[] } }>(
          "/warehouses",
          {},
          "expired-access-token",
        ),
      ]);

      expect(products.data.products).toEqual([]);
      expect(warehouses.data.warehouses).toEqual([]);
      expect(refreshAccessToken).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(onSessionExpired).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });
});
