import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import OrderFormDialog from "./OrderFormDialog";

const options = {
  customers: [
    {
      id: "1",
      customerCode: "CUST-001",
      name: "Maju",
      email: null,
      phone: null,
      address: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
  ],
  warehouses: [
    {
      id: "2",
      code: "WH-001",
      name: "Main",
      address: null,
      isActive: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
  ],
  products: [
    {
      id: "3",
      categoryId: "4",
      sku: "SKU-001",
      name: "Widget",
      description: null,
      unitPrice: "10000",
      isActive: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
    {
      id: "5",
      categoryId: "4",
      sku: "SKU-002",
      name: "Gadget",
      description: null,
      unitPrice: "20000",
      isActive: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
  ],
};

describe("OrderFormDialog", () => {
  it("validates required values", async () => {
    render(
      <OrderFormDialog
        mode="create"
        {...options}
        isSubmitting={false}
        submitError={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Select a customer and warehouse.",
    );
  });

  it("submits create payload without a frontend unit price", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <OrderFormDialog
        mode="create"
        {...options}
        isSubmitting={false}
        submitError={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Customer"), "1");
    await user.selectOptions(screen.getByLabelText("Warehouse"), "2");
    await user.selectOptions(screen.getByLabelText("Product"), "3");
    await user.click(screen.getByRole("button", { name: "Add item" }));
    const productSelects = screen.getAllByLabelText("Product");
    await user.selectOptions(productSelects[1]!, "5");
    await user.click(screen.getByRole("button", { name: "Create Draft" }));

    expect(onSubmit).toHaveBeenCalledWith({
      customerId: "1",
      warehouseId: "2",
      items: [
        { productId: "3", quantity: 1 },
        { productId: "5", quantity: 1 },
      ],
    });
  });

  it("rejects zero quantities", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <OrderFormDialog
        mode="create"
        {...options}
        isSubmitting={false}
        submitError={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Customer"), "1");
    await user.selectOptions(screen.getByLabelText("Warehouse"), "2");
    await user.selectOptions(screen.getByLabelText("Product"), "3");
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "0" },
    });
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Each quantity must be a positive whole number.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit or close while a save is in progress", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(
      <OrderFormDialog
        mode="create"
        {...options}
        isSubmitting
        submitError={null}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Close order form" }),
    ).toBeDisabled();

    fireEvent.submit(dialog.querySelector("form")!);
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
