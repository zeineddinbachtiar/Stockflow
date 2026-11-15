import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import { AuthContext } from "../../context/auth-context";
import type { AuthContextValue } from "../../context/auth-context";
import type { AuthUser, UserRole } from "../../types/auth.types";

import RoleGuard from "./RoleGuard";

const baseUser: AuthUser = {
  id: "user-001",
  fullName: "StockFlow Test User",
  email: "test@stockflow.local",
  role: "ADMIN",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function renderRoleGuard(role: UserRole | null, allowedRoles: UserRole[]) {
  const user: AuthUser | null = role ? { ...baseUser, role } : null;

  const authValue: AuthContextValue = {
    user,
    accessToken: user ? "test-token" : null,
    isAuthenticated: Boolean(user),
    login: async () => undefined,
    logout: () => undefined,
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={["/restricted"]}>
        <Routes>
          <Route path="/" element={<div>Dashboard destination</div>} />

          <Route
            path="/restricted"
            element={
              <RoleGuard allowedRoles={allowedRoles}>
                <div>Restricted content</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("RoleGuard", () => {
  it("allows ADMIN when ADMIN is in the allowed roles", () => {
    renderRoleGuard("ADMIN", ["ADMIN"]);

    expect(screen.getByText("Restricted content")).toBeInTheDocument();
  });

  it("allows WAREHOUSE_STAFF for warehouse-authorized routes", () => {
    renderRoleGuard("WAREHOUSE_STAFF", ["ADMIN", "WAREHOUSE_STAFF"]);

    expect(screen.getByText("Restricted content")).toBeInTheDocument();
  });

  it("redirects SALES_STAFF when the role is not allowed", () => {
    renderRoleGuard("SALES_STAFF", ["ADMIN", "WAREHOUSE_STAFF"]);

    expect(screen.getByText("Dashboard destination")).toBeInTheDocument();

    expect(screen.queryByText("Restricted content")).not.toBeInTheDocument();
  });

  it("redirects when no authenticated user exists", () => {
    renderRoleGuard(null, ["ADMIN"]);

    expect(screen.getByText("Dashboard destination")).toBeInTheDocument();
  });
});
