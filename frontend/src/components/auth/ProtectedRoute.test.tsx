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

function renderProtectedRoute(isAuthenticated: boolean) {
  const authValue: AuthContextValue = {
    user: isAuthenticated ? testUser : null,
    accessToken: isAuthenticated ? "test-token" : null,
    isAuthenticated,
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
});
