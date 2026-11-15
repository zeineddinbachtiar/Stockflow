import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import WarehouseFormDialog from "./WarehouseFormDialog";
import type { Warehouse } from "./warehouse.types";

const warehouse: Warehouse = {
  id: "warehouse-001",
  code: "WH-JKT",
  name: "Jakarta Central Warehouse",
  address: "Central Jakarta",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderDialog(
  overrides: Partial<ComponentProps<typeof WarehouseFormDialog>> = {},
) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  render(
    <WarehouseFormDialog
      mode="create"
      isSubmitting={false}
      submitError={null}
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );

  return { onSubmit, onClose };
}

function submitDialogForm() {
  const form = screen.getByRole("dialog").querySelector("form");

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Warehouse form was not rendered.");
  }

  fireEvent.submit(form);
}

describe("WarehouseFormDialog", () => {
  it("normalizes a new warehouse payload before submission", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(screen.getByLabelText("Warehouse Code"), " wh-sby ");
    await user.type(
      screen.getByLabelText("Warehouse Name"),
      "  Surabaya Distribution Center  ",
    );

    await user.click(screen.getByRole("button", { name: "Create Warehouse" }));

    expect(onSubmit).toHaveBeenCalledWith({
      code: "WH-SBY",
      name: "Surabaya Distribution Center",
      address: null,
    });
  });

  it("submits edited warehouse details", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      mode: "edit",
      warehouse,
    });

    const nameInput = screen.getByLabelText("Warehouse Name");

    await user.clear(nameInput);
    await user.type(nameInput, "Jakarta Main Warehouse");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSubmit).toHaveBeenCalledWith({
      code: "WH-JKT",
      name: "Jakarta Main Warehouse",
      address: "Central Jakarta",
    });
  });

  it.each([
    {
      field: "Warehouse Code",
      value: "",
      message: "Warehouse code is required.",
    },
    {
      field: "Warehouse Name",
      value: "   ",
      message: "Warehouse name is required.",
    },
    {
      field: "Warehouse Code",
      value: "A".repeat(31),
      message: "Warehouse code must not exceed 30 characters.",
    },
    {
      field: "Warehouse Name",
      value: "A".repeat(101),
      message: "Warehouse name must not exceed 100 characters.",
    },
    {
      field: "Address",
      value: "A".repeat(2001),
      message: "Warehouse address must not exceed 2000 characters.",
    },
  ])("rejects invalid values for $field", ({ field, value, message }) => {
    const { onSubmit } = renderDialog();

    // Provide valid values for other required fields.
    fireEvent.change(screen.getByLabelText("Warehouse Code"), {
      target: { value: "WH-TEST" },
    });

    fireEvent.change(screen.getByLabelText("Warehouse Name"), {
      target: { value: "Test Warehouse" },
    });

    // Address label includes "(Optional)" in the UI.
    const fieldLabel = field === "Address" ? /Address/ : field;

    fireEvent.change(screen.getByLabelText(fieldLabel), {
      target: { value },
    });

    submitDialogForm();

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows API errors and disables close actions while submitting", () => {
    const { onClose } = renderDialog({
      isSubmitting: true,
      submitError: "Warehouse code is already registered.",
    });

    const closeButton = screen.getByRole("button", {
      name: "Close warehouse form",
    });

    const cancelButton = screen.getByRole("button", {
      name: "Cancel",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Warehouse code is already registered.",
    );

    expect(closeButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();

    fireEvent.click(closeButton);
    fireEvent.click(cancelButton);

    expect(onClose).not.toHaveBeenCalled();
  });
});
