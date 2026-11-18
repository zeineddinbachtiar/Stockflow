import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { StrictMode } from "react";

import { server } from "../test/mocks/server";

import { useState } from "react";

import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";
import { apiRequest } from "../lib/api";

import type { AuthResult, AuthSession, AuthUser } from "../types/auth.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const SESSION_KEY = "stockflow.auth.session";

const credentials = {
  email: "admin@stockflow.local",
  password: "valid-test-password",
};

const user: AuthUser = {
  id: "user-001",
  fullName: "StockFlow Administrator",
  email: "admin@stockflow.local",
  role: "ADMIN",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const authResult: AuthResult = {
  accessToken: "test-signed-access-token",
  refreshToken: "test-refresh-token",
  tokenType: "Bearer",
  expiresIn: 900,
  user,
};

const expiresAt = Date.now() + authResult.expiresIn * 1000;

const storedSession: AuthSession = {
  accessToken: authResult.accessToken,
  refreshToken: authResult.refreshToken,
  expiresAt,
  user,
};

function AuthProbe() {
  const {
    user: authenticatedUser,
    accessToken,
    isAuthenticated,
    isInitializing,
    sessionRecoveryError,
    retrySessionRecovery,
    login,
    logout,
  } = useAuth();

  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");

  async function handleLogin() {
    setError("");

    try {
      await login(credentials);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    }
  }

  async function handleProtectedRequest() {
    setRequestError("");

    try {
      await apiRequest("/products", {}, accessToken ?? undefined);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Request failed.");
    }
  }

  return (
    <div>
      <output data-testid="authenticated">{String(isAuthenticated)}</output>
      <output data-testid="initializing">{String(isInitializing)}</output>

      <output data-testid="authenticated-email">
        {authenticatedUser?.email ?? "none"}
      </output>

      <output data-testid="access-token">{accessToken ?? "none"}</output>

      <output data-testid="request-error">{requestError}</output>

      {sessionRecoveryError && <div role="alert">{sessionRecoveryError}</div>}

      {error && <div role="alert">{error}</div>}

      <button type="button" onClick={handleLogin}>
        Login
      </button>

      <button type="button" onClick={logout}>
        Logout
      </button>

      <button type="button" onClick={() => void retrySessionRecovery()}>
        Retry session recovery
      </button>

      <button type="button" onClick={handleProtectedRequest}>
        Protected request
      </button>
    </div>
  );
}

function UnprovidedAuthProbe() {
  useAuth();
  return null;
}

function renderAuthProvider(strict = false) {
  const provider = (
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>
  );

  return render(strict ? <StrictMode>{provider}</StrictMode> : provider);
}

describe("AuthContext", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts unauthenticated when no session exists", () => {
    renderAuthProvider();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("authenticated-email")).toHaveTextContent("none");
    expect(screen.getByTestId("access-token")).toHaveTextContent("none");
  });

  it("restores a valid session from sessionStorage", () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));
    const refreshHandler = vi.fn();
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => {
        refreshHandler();
        return HttpResponse.json({ status: "success", data: authResult });
      }),
    );

    renderAuthProvider();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");

    expect(screen.getByTestId("authenticated-email")).toHaveTextContent(
      user.email,
    );

    expect(screen.getByTestId("access-token")).toHaveTextContent(
      authResult.accessToken,
    );
    expect(refreshHandler).not.toHaveBeenCalled();
  });

  it("refreshes an expired access token before restoring authentication", async () => {
    const expiredSession = { ...storedSession, expiresAt: Date.now() - 1_000 };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(expiredSession));

    server.use(
      http.post(`${API_URL}/auth/refresh`, async ({ request }) => {
        expect(await request.json()).toEqual({
          refreshToken: expiredSession.refreshToken,
        });
        return HttpResponse.json({
          status: "success",
          data: {
            ...authResult,
            accessToken: "startup-rotated-access",
            refreshToken: "startup-rotated-refresh",
            expiresIn: 1_800,
          },
        });
      }),
    );

    renderAuthProvider();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(await screen.findByTestId("authenticated")).toHaveTextContent(
      "true",
    );
    expect(screen.getByTestId("access-token")).toHaveTextContent(
      "startup-rotated-access",
    );

    const persistedSession = JSON.parse(
      sessionStorage.getItem(SESSION_KEY)!,
    ) as AuthSession;
    expect(persistedSession.refreshToken).toBe("startup-rotated-refresh");
    expect(persistedSession.expiresAt).toBeGreaterThan(Date.now());
  });

  it("clears an expired session when startup refresh is rejected", async () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...storedSession, expiresAt: Date.now() - 1_000 }),
    );
    server.use(
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "INVALID_REFRESH_TOKEN",
            message: "Refresh token is invalid or expired.",
          },
          { status: 401 },
        ),
      ),
    );

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("initializing")).toHaveTextContent("false");
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("keeps the session and allows retry after a startup network failure", async () => {
    const expiredSession = { ...storedSession, expiresAt: Date.now() - 1_000 };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(expiredSession));
    let attempts = 0;
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => {
        attempts += 1;
        if (attempts === 1) return HttpResponse.error();
        return HttpResponse.json({
          status: "success",
          data: {
            ...authResult,
            accessToken: "retried-access-token",
            refreshToken: "retried-refresh-token",
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderAuthProvider();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot connect to StockFlow API",
    );
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Retry session recovery" }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });
    expect(attempts).toBe(2);
    expect(JSON.parse(sessionStorage.getItem(SESSION_KEY)!).refreshToken).toBe(
      "retried-refresh-token",
    );
  });

  it("keeps an expired session after a startup server error", async () => {
    const expiredSession = { ...storedSession, expiresAt: Date.now() - 1_000 };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(expiredSession));
    server.use(
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "SERVICE_UNAVAILABLE",
            message: "Authentication service is unavailable.",
          },
          { status: 503 },
        ),
      ),
    );

    renderAuthProvider();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Authentication service is unavailable.",
    );
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it("shares one startup refresh while effects are mounted in StrictMode", async () => {
    const expiredSession = { ...storedSession, expiresAt: Date.now() - 1_000 };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(expiredSession));
    let attempts = 0;
    server.use(
      http.post(`${API_URL}/auth/refresh`, async () => {
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({
          status: "success",
          data: { ...authResult, accessToken: "strict-mode-access" },
        });
      }),
    );

    renderAuthProvider(true);

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });
    expect(attempts).toBe(1);
  });

  it("removes malformed session data", () => {
    sessionStorage.setItem(SESSION_KEY, "{invalid-json");

    renderAuthProvider();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it.each([
    {
      description: "an unsupported role",
      user: {
        ...user,
        role: "MANAGER",
      },
    },
    {
      description: "an inactive user",
      user: {
        ...user,
        isActive: false,
      },
    },
  ])(
    "rejects stored session containing $description",
    ({ user: invalidUser }) => {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          accessToken: authResult.accessToken,
          user: invalidUser,
        }),
      );

      renderAuthProvider();

      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");

      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    },
  );

  it.each([
    { description: "a missing refresh token", remove: "refreshToken" },
    { description: "a missing expiry", remove: "expiresAt" },
  ])("rejects stored session containing $description", ({ remove }) => {
    const invalidSession = { ...storedSession } as Record<string, unknown>;
    delete invalidSession[remove];

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(invalidSession));

    renderAuthProvider();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("sends login credentials and persists a valid session", async () => {
    const receivedBodies: unknown[] = [];

    server.use(
      http.post(`${API_URL}/auth/login`, async ({ request }) => {
        receivedBodies.push(await request.json());

        return HttpResponse.json({
          status: "success",
          message: "Login successful.",
          data: authResult,
        });
      }),
    );

    const userEventInstance = userEvent.setup();

    renderAuthProvider();

    await userEventInstance.click(
      screen.getByRole("button", { name: "Login" }),
    );

    expect(await screen.findByTestId("authenticated")).toHaveTextContent(
      "true",
    );

    expect(receivedBodies).toEqual([credentials]);

    expect(screen.getByTestId("authenticated-email")).toHaveTextContent(
      user.email,
    );

    const stored = sessionStorage.getItem(SESSION_KEY);

    expect(stored).not.toBeNull();

    const persistedSession = JSON.parse(stored!) as AuthSession;

    expect(persistedSession).toMatchObject({
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      user,
    });
    expect(persistedSession.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects an invalid authentication response", async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json({
          status: "success",
          data: {
            ...authResult,
            tokenType: "Basic",
          },
        }),
      ),
    );

    const userEventInstance = userEvent.setup();

    renderAuthProvider();

    await userEventInstance.click(
      screen.getByRole("button", { name: "Login" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The API returned an invalid authentication response.",
    );

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("preserves API authentication errors without creating a session", async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          },
          { status: 401 },
        ),
      ),
    );

    const userEventInstance = userEvent.setup();

    renderAuthProvider();

    await userEventInstance.click(
      screen.getByRole("button", { name: "Login" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("removes the current session when logging out", async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));

    const receivedBodies: unknown[] = [];

    server.use(
      http.post(`${API_URL}/auth/logout`, async ({ request }) => {
        receivedBodies.push(await request.json());

        return HttpResponse.json({
          status: "success",
          message: "Logout successful.",
        });
      }),
    );

    const userEventInstance = userEvent.setup();

    renderAuthProvider();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");

    await userEventInstance.click(
      screen.getByRole("button", { name: "Logout" }),
    );

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("authenticated-email")).toHaveTextContent("none");
    expect(screen.getByTestId("access-token")).toHaveTextContent("none");

    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();

    await waitFor(() => {
      expect(receivedBodies).toEqual([
        { refreshToken: storedSession.refreshToken },
      ]);
    });
  });

  it("refreshes before expiry and persists rotated tokens", async () => {
    const expiringSession: AuthSession = {
      ...storedSession,
      expiresAt: Date.now() + 120_000,
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(expiringSession));

    server.use(
      http.post(`${API_URL}/auth/refresh`, async ({ request }) => {
        expect(await request.json()).toEqual({
          refreshToken: expiringSession.refreshToken,
        });

        return HttpResponse.json({
          status: "success",
          data: {
            ...authResult,
            accessToken: "rotated-access-token",
            refreshToken: "rotated-refresh-token",
            expiresIn: 900,
          },
        });
      }),
    );

    const timerCallbacks: Array<() => void | Promise<void>> = [];
    const originalSetTimeout = globalThis.setTimeout;

    vi.spyOn(globalThis, "setTimeout").mockImplementation(
      (handler, timeout, ...args) => {
        if (
          typeof handler === "function" &&
          typeof timeout === "number" &&
          timeout >= 59_000 &&
          timeout <= 61_000
        ) {
          timerCallbacks.push(() => handler(...args));
          return 0 as unknown as ReturnType<typeof setTimeout>;
        }

        return originalSetTimeout(handler, timeout, ...args);
      },
    );

    renderAuthProvider();

    expect(timerCallbacks).toHaveLength(1);
    await timerCallbacks[0]!();

    await waitFor(() => {
      expect(screen.getByTestId("access-token")).toHaveTextContent(
        "rotated-access-token",
      );
    });

    const persistedSession = JSON.parse(
      sessionStorage.getItem(SESSION_KEY)!,
    ) as AuthSession;

    expect(persistedSession.refreshToken).toBe("rotated-refresh-token");
    expect(persistedSession.expiresAt).toBeGreaterThan(Date.now());
  });

  it("ends the session when the refresh token is rejected", async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));

    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "INVALID_ACCESS_TOKEN",
          },
          { status: 401 },
        ),
      ),
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "INVALID_REFRESH_TOKEN",
          },
          { status: 401 },
        ),
      ),
    );

    const userEventInstance = userEvent.setup();
    renderAuthProvider();

    await userEventInstance.click(
      screen.getByRole("button", { name: "Protected request" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });

    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("keeps the session when refresh fails because of a network error", async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));

    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "INVALID_ACCESS_TOKEN",
          },
          { status: 401 },
        ),
      ),
      http.post(`${API_URL}/auth/refresh`, () => HttpResponse.error()),
    );

    const userEventInstance = userEvent.setup();
    renderAuthProvider();

    await userEventInstance.click(
      screen.getByRole("button", { name: "Protected request" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("request-error")).not.toHaveTextContent("");
    });

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      expect(() => render(<UnprovidedAuthProbe />)).toThrow(
        "useAuth must be used inside AuthProvider.",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
