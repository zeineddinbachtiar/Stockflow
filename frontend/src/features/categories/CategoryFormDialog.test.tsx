import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CategoryFormDialog from "./CategoryFormDialog";
import type { Category } from "./category.types";

function submitCategoryForm() {
  const form = screen.getByRole("dialog").querySelector("form");

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Category form was not rendered.");
  }

  fireEvent.submit(form);
}

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
  it.each([
    {
      field: "Category Name",
      value: "   ",
      message: "Category name is required.",
    },
    {
      field: "Category Name",
      value: "A".repeat(101),
      message: "Category name must not exceed 100 characters.",
    },
    {
      field: "Description",
      value: "A".repeat(2001),
      message: "Category description must not exceed 2000 characters.",
    },
  ])("rejects invalid $field values", ({ field, value, message }) => {
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

    fireEvent.change(screen.getByLabelText("Category Name"), {
      target: {
        value: field === "Category Name" ? value : "Valid Category",
      },
    });

    if (field === "Description") {
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value },
      });
    }

    submitCategoryForm();

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits null when the optional description is empty", async () => {
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

    await user.type(screen.getByLabelText("Category Name"), "Storage");

    await user.type(screen.getByLabelText(/Description/), "   ");

    await user.click(screen.getByRole("button", { name: "Create Category" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Storage",
      description: null,
    });
  });

  it("closes only when the dialog backdrop is clicked", () => {
    const onClose = vi.fn();

    render(
      <CategoryFormDialog
        mode="create"
        isSubmitting={false}
        submitError={null}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement;

    if (!backdrop) {
      throw new Error("Category dialog backdrop was not rendered.");
    }

    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the backdrop is clicked while submitting", () => {
    const onClose = vi.fn();

    render(
      <CategoryFormDialog
        mode="create"
        isSubmitting
        submitError={null}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement;

    if (!backdrop) {
      throw new Error("Category dialog backdrop was not rendered.");
    }

    fireEvent.mouseDown(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });
});
