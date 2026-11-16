import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import ModalDialog from "../../components/ui/ModalDialog";

import type { Warehouse, WarehousePayload } from "./warehouse.types";

interface WarehouseFormDialogProps {
  mode: "create" | "edit";
  warehouse?: Warehouse;
  isSubmitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onSubmit: (payload: WarehousePayload) => void;
}

export default function WarehouseFormDialog({
  mode,
  warehouse,
  isSubmitting,
  submitError,
  onClose,
  onSubmit,
}: WarehouseFormDialogProps) {
  const [code, setCode] = useState(warehouse?.code ?? "");
  const [name, setName] = useState(warehouse?.name ?? "");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    const normalizedCode = code.trim().toUpperCase();
    const normalizedName = name.trim();
    const normalizedAddress = address.trim();

    if (!normalizedCode) {
      setValidationError("Warehouse code is required.");
      return;
    }

    if (normalizedCode.length > 30) {
      setValidationError("Warehouse code must not exceed 30 characters.");
      return;
    }

    if (!normalizedName) {
      setValidationError("Warehouse name is required.");
      return;
    }

    if (normalizedName.length > 100) {
      setValidationError("Warehouse name must not exceed 100 characters.");
      return;
    }

    if (normalizedAddress.length > 2000) {
      setValidationError("Warehouse address must not exceed 2000 characters.");
      return;
    }

    onSubmit({
      code: normalizedCode,
      name: normalizedName,
      address: normalizedAddress || null,
    });
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50";

  return (
    <ModalDialog
      title={mode === "create" ? "Add Warehouse" : "Edit Warehouse"}
      closeLabel="Close warehouse form"
      closeDisabled={isSubmitting}
      description={
        mode === "create"
          ? "Register a new warehouse location."
          : "Update warehouse information."
      }
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      footer={
        <>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="warehouse-form"
            disabled={isSubmitting}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? "Saving..."
              : mode === "create"
                ? "Create Warehouse"
                : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="warehouse-form" onSubmit={handleSubmit}>
        <div className="space-y-5 p-6">
          {(validationError || submitError) && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{validationError ?? submitError}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="warehouse-code"
              className="text-sm font-semibold text-slate-700"
            >
              Warehouse Code
            </label>

            <input
              id="warehouse-code"
              required
              maxLength={30}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="e.g. WH-JKT-001"
              disabled={isSubmitting}
              className={inputClass}
            />

            <p className="mt-1 text-right text-xs text-slate-400">
              {code.length}/30
            </p>
          </div>

          <div>
            <label
              htmlFor="warehouse-name"
              className="text-sm font-semibold text-slate-700"
            >
              Warehouse Name
            </label>

            <input
              id="warehouse-name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Jakarta Main Warehouse"
              disabled={isSubmitting}
              className={inputClass}
            />

            <p className="mt-1 text-right text-xs text-slate-400">
              {name.length}/100
            </p>
          </div>

          <div>
            <label
              htmlFor="warehouse-address"
              className="text-sm font-semibold text-slate-700"
            >
              Address
              <span className="ml-1 font-normal text-slate-400">
                (Optional)
              </span>
            </label>

            <textarea
              id="warehouse-address"
              rows={4}
              maxLength={2000}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Enter warehouse address..."
              disabled={isSubmitting}
              className={`${inputClass} resize-y`}
            />

            <p className="mt-1 text-right text-xs text-slate-400">
              {address.length}/2000
            </p>
          </div>
        </div>
      </form>
    </ModalDialog>
  );
}
