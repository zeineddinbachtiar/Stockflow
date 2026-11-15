import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

import { AuthContext } from "../../context/auth-context";
import type { AuthContextValue } from "../../context/auth-context";
import type { AuthUser, UserRole } from "../../types/auth.types";

import Topbar from "./Topbar";

const baseUser: AuthUser = {
  id: "user-001",
  fullName: "StockFlow Test User",
  email: "test@stockflow.local",
  role: "ADMIN",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function renderTopbar(initialPath = "/products", role: UserRole = "ADMIN") {
  const logout = vi.fn();
  const onMenuClick = vi.fn();

  const user: AuthUser = {
    ...baseUser,
    role,
  };

  const authValue: AuthContextValue = {
    user,
    accessToken: "test-access-token",
    isAuthenticated: true,
    login: async () => undefined,
    logout,
  };

  render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<div>Login destination</div>} />

          <Route path="*" element={<Topbar onMenuClick={onMenuClick} />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

  return { logout, onMenuClick };
}

describe("Topbar", () => {
  it("displays the current page title and authenticated user", () => {
    renderTopbar("/products", "WAREHOUSE_STAFF");

    expect(
      screen.getByRole("heading", { name: "Products" }),
    ).toBeInTheDocument();

    expect(screen.getByText("Workspace / Products")).toBeInTheDocument();

    expect(screen.getByText("StockFlow Test User")).toBeInTheDocument();

    expect(screen.getByText("WAREHOUSE STAFF")).toBeInTheDocument();

    expect(screen.getByText("Authenticated")).toBeInTheDocument();
  });

  it("calls onMenuClick when the navigation menu button is clicked", async () => {
    const user = userEvent.setup();
    const { onMenuClick } = renderTopbar();

    await user.click(
      screen.getByRole("button", {
        name: "Open navigation menu",
      }),
    );

    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it("logs out and redirects to login when Sign out is clicked", async () => {
    const user = userEvent.setup();
    const { logout } = renderTopbar("/products");

    await user.click(
      screen.getByRole("button", {
        name: "Sign out",
      }),
    );

    expect(logout).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Login destination")).toBeInTheDocument();
  });

  it("uses the default StockFlow title for an unmapped route", () => {
    renderTopbar("/unknown-page");

    expect(
      screen.getByRole("heading", { name: "StockFlow" }),
    ).toBeInTheDocument();

    expect(screen.getByText("Workspace / StockFlow")).toBeInTheDocument();
  });
});
