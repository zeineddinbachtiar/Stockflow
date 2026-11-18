import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";

import { AuthContext } from "../../context/auth-context";
import { AuthProvider } from "../../context/AuthContext";
import type { AuthContextValue } from "../../context/auth-context";
import type { AuthUser } from "../../types/auth.types";
import { server } from "../../test/mocks/server";

import ProtectedRoute from "./ProtectedRoute";

const testUser: AuthUser = {
  id: "user-001",
  fullName: "StockFlow Test User",
  email: "test@stockflow.local",
  role: "ADMIN",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");
const SESSION_KEY = "stockflow.auth.session";

function renderProtectedRoute(
  isAuthenticated: boolean,
  options: {
    isInitializing?: boolean;
    sessionRecoveryError?: string | null;
    retrySessionRecovery?: () => Promise<void>;
  } = {},
) {
  const authValue: AuthContextValue = {
    user: isAuthenticated ? testUser : null,
    accessToken: isAuthenticated ? "test-token" : null,
    isAuthenticated,
    isInitializing: options.isInitializing ?? false,
    sessionRecoveryError: options.sessionRecoveryError ?? null,
    retrySessionRecovery:
      options.retrySessionRecovery ?? (async () => undefined),
    login: async () => undefined,
    logout: () => undefined,
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route path="/login" element={<div>Login destination</div>} />

          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<div>Private content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to login", () => {
    renderProtectedRoute(false);

    expect(screen.getByText("Login destination")).toBeInTheDocument();

    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("renders protected content for authenticated users", () => {
    renderProtectedRoute(true);

    expect(screen.getByText("Private content")).toBeInTheDocument();

    expect(screen.queryByText("Login destination")).not.toBeInTheDocument();
  });

  it("does not render protected content while session recovery is in progress", () => {
    renderProtectedRoute(false, { isInitializing: true });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Restoring your session",
    );
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
    expect(screen.queryByText("Login destination")).not.toBeInTheDocument();
  });

  it("offers a retry instead of discarding a session after a transient recovery error", () => {
    renderProtectedRoute(false, {
      sessionRecoveryError: "Cannot connect to StockFlow API.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cannot connect to StockFlow API.",
    );
    expect(
      screen.getByRole("button", { name: "Retry session recovery" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
    expect(screen.queryByText("Login destination")).not.toBeInTheDocument();
  });

  it("redirects to login and clears storage when startup refresh is rejected", async () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        accessToken: "expired-access-token",
        refreshToken: "revoked-refresh-token",
        expiresAt: Date.now() - 1_000,
        user: testUser,
      }),
    );
    server.use(
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "INVALID_REFRESH_TOKEN",
            message: "Refresh token is invalid.",
          },
          { status: 401 },
        ),
      ),
    );

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/private"]}>
          <Routes>
            <Route path="/login" element={<div>Login destination</div>} />

            <Route element={<ProtectedRoute />}>
              <Route path="/private" element={<div>Private content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByText("Login destination")).toBeInTheDocument();
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
