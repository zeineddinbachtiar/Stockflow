import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import useModalDialog from "./useModalDialog";

interface ModalDialogProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  closeDisabled?: boolean;
  maxWidth?: string;
  labelledBy?: string;
  describedBy?: string;
}

export default function ModalDialog({
  title,
  description,
  onClose,
  children,
  footer,
  closeLabel = "Close dialog",
  closeDisabled = false,
  maxWidth = "max-w-lg",
  labelledBy,
  describedBy,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const resolvedTitleId = labelledBy ?? titleId;
  const resolvedDescriptionId =
    describedBy ?? (description ? descriptionId : undefined);
  useModalDialog(dialogRef, onClose);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        aria-describedby={resolvedDescriptionId}
        tabIndex={-1}
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-2xl bg-white shadow-xl outline-none`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2
              id={resolvedTitleId}
              className="text-xl font-bold text-slate-900"
            >
              {title}
            </h2>
            {description && (
              <p
                id={resolvedDescriptionId}
                className="mt-1 text-sm text-slate-500"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            disabled={closeDisabled}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={19} />
          </button>
        </div>

        <div className="p-6">{children}</div>

        {footer && (
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
