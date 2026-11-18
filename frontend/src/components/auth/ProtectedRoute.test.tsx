import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { AuthContext } from "../../context/auth-context";
import type { AuthContextValue } from "../../context/auth-context";
import type { AuthUser } from "../../types/auth.types";

import ProtectedRoute from "./ProtectedRoute";

const testUser: AuthUser = {
  id: "user-001",
  fullName: "StockFlow Test User",
  email: "test@stockflow.local",
  role: "ADMIN",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

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
});
