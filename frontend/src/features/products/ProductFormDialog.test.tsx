import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProductFormDialog from "./ProductFormDialog";
import type { Category, Product } from "./product.types";

const category: Category = {
  id: "category-001",
  name: "Computers",
  description: "Computer products",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ProductFormDialog", () => {
  it("creates a product with normalized values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ProductFormDialog
        mode="create"
        categories={[category]}
        categoriesLoading={false}
        categoriesError={null}
        isSubmitting={false}
        submitError={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Category"), "category-001");

    await user.type(screen.getByLabelText("SKU"), "lap-003");

    await user.type(screen.getByLabelText("Product Name"), "Business Laptop");

    await user.type(screen.getByLabelText("Unit Price"), "14999000.00");

    await user.type(screen.getByLabelText(/Description/), "Business laptop");

    await user.click(
      screen.getByRole("button", {
        name: "Create Product",
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      categoryId: "category-001",
      sku: "LAP-003",
      name: "Business Laptop",
      unitPrice: "14999000.00",
      description: "Business laptop",
    });
  });

  it("loads existing product values in edit mode", () => {
    const product: Product = {
      id: "product-001",
      categoryId: "category-001",
      sku: "LAP-001",
      name: "Business Laptop",
      description: "14-inch laptop",
      unitPrice: "14999000.00",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    render(
      <ProductFormDialog
        mode="edit"
        product={product}
        categories={[category]}
        categoriesLoading={false}
        categoriesError={null}
        isSubmitting={false}
        submitError={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("SKU")).toHaveValue("LAP-001");
    expect(screen.getByLabelText("Product Name")).toHaveValue(
      "Business Laptop",
    );

    expect(
      screen.getByRole("button", {
        name: "Save Changes",
      }),
    ).toBeInTheDocument();
  });

  it("rejects invalid unit prices", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ProductFormDialog
        mode="create"
        categories={[category]}
        categoriesLoading={false}
        categoriesError={null}
        isSubmitting={false}
        submitError={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Category"), "category-001");

    await user.type(screen.getByLabelText("SKU"), "LAP-003");
    await user.type(screen.getByLabelText("Product Name"), "Business Laptop");
    await user.type(screen.getByLabelText("Unit Price"), "12,000");

    await user.click(
      screen.getByRole("button", {
        name: "Create Product",
      }),
    );

    expect(
      screen.getByText(
        "Enter a valid non-negative price with up to 2 decimal places.",
      ),
    ).toBeInTheDocument();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("displays category loading errors", () => {
    render(
      <ProductFormDialog
        mode="create"
        categories={[]}
        categoriesLoading={false}
        categoriesError="Unable to load categories."
        isSubmitting={false}
        submitError={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/Unable to load categories/)).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Create Product",
      }),
    ).toBeDisabled();
  });
});
