import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import InventoryOperationDialog, {
  type InventoryOperation,
} from "./InventoryOperationDialog";
import type { InventoryBalance } from "./inventory.types";
import type { Product } from "../products/product.types";
import type { Warehouse } from "../warehouses/warehouse.types";

const warehouse: Warehouse = {
  id: "warehouse-001",
  code: "WH-JKT",
  name: "Jakarta Central Warehouse",
  address: "Jakarta",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const product: Product = {
  id: "product-001",
  categoryId: "category-001",
  sku: "LAP-001",
  name: "Business Laptop",
  description: null,
  unitPrice: "100.00",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const inventory: InventoryBalance = {
  id: "inventory-001",
  warehouseId: warehouse.id,
  warehouseCode: warehouse.code,
  warehouseName: warehouse.name,
  warehouseIsActive: true,
  productId: product.id,
  productSku: product.sku,
  productName: product.name,
  productIsActive: true,
  quantityOnHand: 12,
  reorderLevel: 5,
  isLowStock: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderDialog(mode: InventoryOperation, isSubmitting = false) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  render(
    <InventoryOperationDialog
      mode={mode}
      inventory={mode === "reorder" ? inventory : undefined}
      warehouses={[warehouse]}
      products={[product]}
      warehousesLoading={false}
      productsLoading={false}
      warehousesError={null}
      productsError={null}
      isSubmitting={isSubmitting}
      submitError={null}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );

  return { onSubmit, onClose };
}

describe("InventoryOperationDialog", () => {
  it.each(["receipt", "issue"] as const)(
    "%s requires warehouse, product, and a positive whole quantity",
    async (mode) => {
      const user = userEvent.setup();
      const { onSubmit } = renderDialog(mode);
      const dialog = screen.getByRole("dialog");
      const form = dialog.querySelector("form")!;

      fireEvent.submit(form);
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Select a warehouse and product.",
      );

      const selects = dialog.querySelectorAll("select");
      await user.selectOptions(selects[0]!, warehouse.id);
      await user.selectOptions(selects[1]!, product.id);

      const quantity = dialog.querySelector('input[type="number"]')!;
      await user.type(quantity, "0");
      fireEvent.submit(form);
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Quantity must be a positive whole number.",
      );
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("requires a non-zero adjustment and an audit reason", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog("adjustment");
    const dialog = screen.getByRole("dialog");
    const form = dialog.querySelector("form")!;
    const selects = dialog.querySelectorAll("select");

    await user.selectOptions(selects[0]!, warehouse.id);
    await user.selectOptions(selects[1]!, product.id);

    const quantity = dialog.querySelector('input[type="number"]')!;
    await user.type(quantity, "0");
    fireEvent.submit(form);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Adjustment cannot be zero.",
    );

    await user.clear(quantity);
    await user.type(quantity, "-1");
    fireEvent.submit(form);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "A reason is required for an adjustment.",
    );

    await user.type(dialog.querySelector("textarea")!, "Cycle count");
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledWith({
      warehouseId: warehouse.id,
      productId: product.id,
      quantityDelta: -1,
      reason: "Cycle count",
    });
  });

  it("requires a non-negative whole-number reorder level", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog("reorder");
    const dialog = screen.getByRole("dialog");
    const form = dialog.querySelector("form")!;
    const reorderLevel = within(dialog).getByLabelText("Reorder level");

    fireEvent.change(reorderLevel, { target: { value: "-1" } });
    fireEvent.submit(form);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Reorder level must be a whole number of 0 or more.",
    );

    fireEvent.change(reorderLevel, { target: { value: "1.5" } });
    fireEvent.submit(form);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Reorder level must be a whole number of 0 or more.",
    );

    await user.clear(reorderLevel);
    await user.type(reorderLevel, "4");
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledWith({ reorderLevel: 4 });
  });

  it("does not submit again while a mutation is in progress", () => {
    const { onSubmit } = renderDialog("receipt", true);
    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).getByRole("button", { name: "Saving..." }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();

    fireEvent.submit(dialog.querySelector("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
