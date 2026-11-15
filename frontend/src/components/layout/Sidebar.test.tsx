import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { renderWithProviders } from "../../test/renderWithProviders";
import type { UserRole } from "../../types/auth.types";
import Sidebar from "./Sidebar";

function renderSidebar(role: UserRole = "ADMIN", initialPath = "/") {
  const onNavigate = vi.fn();

  renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar isOpen onNavigate={onNavigate} />
    </MemoryRouter>,
    role,
  );

  return { onNavigate };
}

describe("Sidebar", () => {
  it("displays all navigation sections and links for ADMIN", () => {
    renderSidebar("ADMIN");

    expect(
      screen.getByRole("heading", { name: "StockFlow" }),
    ).toBeInTheDocument();

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();

    for (const label of [
      "Dashboard",
      "Products",
      "Categories",
      "Warehouses",
      "Inventory",
      "Stock Movements",
      "Customers",
      "Orders",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }

    expect(screen.getByText("ADMIN")).toBeInTheDocument();
  });

  it.each([
    {
      role: "WAREHOUSE_STAFF" as const,
      visible: "Stock Movements",
      hidden: "Customers",
      roleLabel: "WAREHOUSE STAFF",
    },
    {
      role: "SALES_STAFF" as const,
      visible: "Customers",
      hidden: "Stock Movements",
      roleLabel: "SALES STAFF",
    },
  ])(
    "$role sees navigation according to assigned permissions",
    ({ role, visible, hidden, roleLabel }) => {
      renderSidebar(role);

      expect(screen.getByRole("link", { name: visible })).toBeInTheDocument();

      expect(
        screen.queryByRole("link", { name: hidden }),
      ).not.toBeInTheDocument();

      expect(screen.getByText(roleLabel)).toBeInTheDocument();

      expect(
        screen.getByRole("link", { name: "Dashboard" }),
      ).toBeInTheDocument();
    },
  );

  it("marks the current navigation link as active", () => {
    renderSidebar("ADMIN", "/products");

    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("calls onNavigate when a navigation link is clicked", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderSidebar("ADMIN");

    await user.click(screen.getByRole("link", { name: "Products" }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
