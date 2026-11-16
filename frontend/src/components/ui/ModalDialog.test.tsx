import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import ModalDialog from "./ModalDialog";

function Harness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open modal
      </button>
      {open && (
        <ModalDialog
          title="Accessible modal"
          description="Modal description"
          onClose={() => setOpen(false)}
          footer={<button type="button">Last action</button>}
        >
          <button type="button">First action</button>
        </ModalDialog>
      )}
    </>
  );
}

describe("ModalDialog accessibility lifecycle", () => {
  it("handles Escape, locks body scroll, and restores focus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open modal" });

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);
  });

  it("traps Tab navigation at both ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open modal" }));

    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close dialog" });
    const last = screen.getByRole("button", { name: "Last action" });

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
