import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CategoryFormDialog from "./CategoryFormDialog";
import type { Category } from "./category.types";

describe("CategoryFormDialog", () => {
  it("creates a category with trimmed values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CategoryFormDialog
        mode="create"
        isSubmitting={false}
        submitError={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Category Name"), "  Displays  ");

    await user.type(
      screen.getByLabelText(/Description/),
      "  Monitor products  ",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Create Category",
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Displays",
      description: "Monitor products",
    });
  });

  it("loads existing values in edit mode", () => {
    const category: Category = {
      id: "category-001",
      name: "Computers",
      description: "Computer products",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    render(
      <CategoryFormDialog
        mode="edit"
        category={category}
        isSubmitting={false}
        submitError={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Category Name")).toHaveValue("Computers");

    expect(screen.getByLabelText(/Description/)).toHaveValue(
      "Computer products",
    );

    expect(
      screen.getByRole("button", {
        name: "Save Changes",
      }),
    ).toBeInTheDocument();
  });

  it("displays API errors", () => {
    render(
      <CategoryFormDialog
        mode="create"
        isSubmitting={false}
        submitError="Category name already exists."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Category name already exists.",
    );
  });

  it("disables submission while saving", () => {
    render(
      <CategoryFormDialog
        mode="create"
        isSubmitting={true}
        submitError={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Saving...",
      }),
    ).toBeDisabled();
  });
});
