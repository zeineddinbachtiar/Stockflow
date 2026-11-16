import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { render } from "@testing-library/react";
import CustomerFormDialog from "./CustomerFormDialog";

const defaultProps = {
  mode: "create" as const,
  isSubmitting: false,
  submitError: null,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
};

describe("CustomerFormDialog", () => {
  it("validates required fields before submitting", async () => {
    const user = userEvent.setup();
    render(<CustomerFormDialog {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Create Customer" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Customer code is required.",
    );
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("normalizes optional values to null and submits the customer payload", async () => {
    const user = userEvent.setup();
    render(<CustomerFormDialog {...defaultProps} />);

    await user.type(screen.getByLabelText("Customer Code"), " cust-001 ");
    await user.type(screen.getByLabelText("Customer Name"), " PT Maju Jaya ");
    await user.click(screen.getByRole("button", { name: "Create Customer" }));

    expect(defaultProps.onSubmit).toHaveBeenCalledWith({
      customerCode: "cust-001",
      name: "PT Maju Jaya",
      email: null,
      phone: null,
      address: null,
    });
  });

  it("shows a backend submit error", () => {
    render(
      <CustomerFormDialog
        {...defaultProps}
        submitError="Customer code is already registered."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Customer code is already registered.",
    );
  });
});
