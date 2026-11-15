import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "../test/mocks/server";

import { useState } from "react";

import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";

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
  tokenType: "Bearer",
  expiresIn: 900,
  user,
};

const storedSession: AuthSession = {
  accessToken: authResult.accessToken,
  user,
};

function AuthProbe() {
  const {
    user: authenticatedUser,
    accessToken,
    isAuthenticated,
    login,
    logout,
  } = useAuth();

  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");

    try {
      await login(credentials);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    }
  }

  return (
    <div>
      <output data-testid="authenticated">{String(isAuthenticated)}</output>

      <output data-testid="authenticated-email">
        {authenticatedUser?.email ?? "none"}
      </output>

      <output data-testid="access-token">{accessToken ?? "none"}</output>

      {error && <div role="alert">{error}</div>}

      <button type="button" onClick={handleLogin}>
        Login
      </button>

      <button type="button" onClick={logout}>
        Logout
      </button>
    </div>
  );
}

function UnprovidedAuthProbe() {
  useAuth();
  return null;
}

function renderAuthProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("starts unauthenticated when no session exists", () => {
    renderAuthProvider();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("authenticated-email")).toHaveTextContent("none");
    expect(screen.getByTestId("access-token")).toHaveTextContent("none");
  });

  it("restores a valid session from sessionStorage", () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));

    renderAuthProvider();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");

    expect(screen.getByTestId("authenticated-email")).toHaveTextContent(
      user.email,
    );

    expect(screen.getByTestId("access-token")).toHaveTextContent(
      authResult.accessToken,
    );
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

    expect(JSON.parse(stored!) as AuthSession).toEqual(storedSession);
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
