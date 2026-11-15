import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

import { renderWithProviders } from "../../test/renderWithProviders";
import AppLayout from "./AppLayout";

function renderAppLayout(initialPath = "/") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<div>Dashboard outlet content</div>} />

          <Route path="products" element={<div>Products outlet content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppLayout", () => {
  it("renders the application layout and active route content", () => {
    renderAppLayout();

    expect(screen.getByRole("main")).toHaveTextContent(
      "Dashboard outlet content",
    );

    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Products" })).toBeInTheDocument();
  });

  it("opens and closes the mobile navigation overlay", async () => {
    const user = userEvent.setup();

    renderAppLayout();

    expect(
      screen.queryByRole("button", {
        name: "Close navigation menu",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Open navigation menu",
      }),
    );

    expect(
      screen.getByRole("button", {
        name: "Close navigation menu",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Close navigation menu",
      }),
    );

    expect(
      screen.queryByRole("button", {
        name: "Close navigation menu",
      }),
    ).not.toBeInTheDocument();
  });

  it("closes the mobile navigation after selecting a page", async () => {
    const user = userEvent.setup();

    renderAppLayout();

    await user.click(
      screen.getByRole("button", {
        name: "Open navigation menu",
      }),
    );

    expect(
      screen.getByRole("button", {
        name: "Close navigation menu",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Products" }));

    expect(
      await screen.findByText("Products outlet content"),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Close navigation menu",
      }),
    ).not.toBeInTheDocument();
  });
});
