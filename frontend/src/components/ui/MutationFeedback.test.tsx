import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MutationFeedback from "./MutationFeedback";

describe("MutationFeedback", () => {
  it("announces success feedback and supports dismissal", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(
      <MutationFeedback
        successMessage="Product created successfully."
        onDismissSuccess={onDismiss}
      />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Product created successfully.",
    );

    await user.click(
      screen.getByRole("button", { name: "Dismiss success message" }),
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("announces mutation errors without hiding the API message", () => {
    render(
      <MutationFeedback
        errorTitle="Unable to deactivate product"
        errorMessage="Product is referenced by an order."
      />,
    );

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Product is referenced by an order.",
    );
  });
});
