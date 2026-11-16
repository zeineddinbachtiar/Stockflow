import type { ReactNode } from "react";

import ModalDialog from "./ModalDialog";

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isConfirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: "primary" | "danger";
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  isConfirming,
  onCancel,
  onConfirm,
  tone = "primary",
}: ConfirmDialogProps) {
  return (
    <ModalDialog
      title={title}
      description="Review the consequence before continuing."
      onClose={onCancel}
      maxWidth="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {isConfirming ? "Processing..." : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-6 text-slate-600">{description}</p>
    </ModalDialog>
  );
}
