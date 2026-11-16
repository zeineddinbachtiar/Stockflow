import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("does not confirm when cancelled", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        title="Cancel order?"
        description="This will change the order status."
        confirmLabel="Cancel order"
        isConfirming={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms only after the explicit confirmation action", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        title="Issue stock?"
        description="This reduces inventory."
        confirmLabel="Issue stock"
        isConfirming={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Issue stock" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("disables both actions while confirming", () => {
    render(
      <ConfirmDialog
        title="Confirm"
        description="Processing"
        confirmLabel="Confirm"
        isConfirming
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Processing..." }),
    ).toBeDisabled();
  });
});
