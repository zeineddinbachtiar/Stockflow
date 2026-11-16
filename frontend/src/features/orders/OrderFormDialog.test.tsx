import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  ],
};

describe("OrderFormDialog", () => {
  it("validates required values", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole("button", { name: "Create Draft" }));
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
    await user.click(screen.getByRole("button", { name: "Create Draft" }));

    expect(onSubmit).toHaveBeenCalledWith({
      customerId: "1",
      warehouseId: "2",
      items: [{ productId: "3", quantity: 1 }],
    });
  });
});
