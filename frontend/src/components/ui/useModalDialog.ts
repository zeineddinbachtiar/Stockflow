import { useEffect, useRef, type RefObject } from "react";

let openModalCount = 0;
let previousBodyOverflow = "";

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getAttribute("aria-hidden") !== "true");
}

export default function useModalDialog(
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled = true,
): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!enabled) return;

    const restoreFocus = document.activeElement as HTMLElement | null;
    openModalCount += 1;

    if (openModalCount === 1) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    const dialog = dialogRef.current;
    const focusable = dialog ? getFocusableElements(dialog) : [];
    (focusable[0] ?? dialog)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const currentFocusable = getFocusableElements(dialog);
      if (currentFocusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog?.addEventListener("keydown", handleKeyDown);

    return () => {
      dialog?.removeEventListener("keydown", handleKeyDown);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0)
        document.body.style.overflow = previousBodyOverflow;
      restoreFocus?.focus();
    };
  }, [dialogRef, enabled]);
}
