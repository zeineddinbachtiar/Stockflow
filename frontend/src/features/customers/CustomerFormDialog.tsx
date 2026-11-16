import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import ModalDialog from "../../components/ui/ModalDialog";

import type { Customer, CustomerPayload } from "./customer.types";

interface CustomerFormDialogProps {
  mode: "create" | "edit";
  customer?: Customer;
  isSubmitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onSubmit: (payload: CustomerPayload) => void;
}

export default function CustomerFormDialog({
  mode,
  customer,
  isSubmitting,
  submitError,
  onClose,
  onSubmit,
}: CustomerFormDialogProps) {
  const [customerCode, setCustomerCode] = useState(
    customer?.customerCode ?? "",
  );
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    const normalizedCode = customerCode.trim();
    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    const normalizedAddress = address.trim();

    if (!normalizedCode) {
      setValidationError("Customer code is required.");
      return;
    }
    if (normalizedCode.length > 30) {
      setValidationError("Customer code must not exceed 30 characters.");
      return;
    }
    if (!normalizedName) {
      setValidationError("Customer name is required.");
      return;
    }
    if (normalizedName.length > 150) {
      setValidationError("Customer name must not exceed 150 characters.");
      return;
    }
    if (normalizedEmail.length > 150) {
      setValidationError("Customer email must not exceed 150 characters.");
      return;
    }
    if (normalizedEmail && !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setValidationError("Enter a valid customer email.");
      return;
    }
    if (normalizedPhone.length > 30) {
      setValidationError("Customer phone must not exceed 30 characters.");
      return;
    }
    if (normalizedAddress.length > 5000) {
      setValidationError("Customer address must not exceed 5000 characters.");
      return;
    }

    onSubmit({
      customerCode: normalizedCode,
      name: normalizedName,
      email: normalizedEmail || null,
      phone: normalizedPhone || null,
      address: normalizedAddress || null,
    });
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50";

  return (
    <ModalDialog
      title={mode === "create" ? "Add Customer" : "Edit Customer"}
      closeLabel="Close customer form"
      closeDisabled={isSubmitting}
      description={
        mode === "create"
          ? "Create a customer record."
          : "Update customer information."
      }
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="customer-form"
            disabled={isSubmitting}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting
              ? "Saving..."
              : mode === "create"
                ? "Create Customer"
                : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit}>
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          {(validationError || submitError) && (
            <div
              role="alert"
              className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{validationError ?? submitError}</span>
            </div>
          )}
          <label className="text-sm font-semibold text-slate-700">
            Customer Code
            <input
              value={customerCode}
              onChange={(event) => setCustomerCode(event.target.value)}
              maxLength={30}
              disabled={isSubmitting}
              placeholder="e.g. CUST-001"
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Customer Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={150}
              disabled={isSubmitting}
              placeholder="e.g. PT Maju Jaya"
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Email
            <span className="ml-1 font-normal text-slate-400">(Optional)</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={150}
              disabled={isSubmitting}
              placeholder="customer@example.com"
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Phone
            <span className="ml-1 font-normal text-slate-400">(Optional)</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={30}
              disabled={isSubmitting}
              placeholder="+62..."
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Address
            <span className="ml-1 font-normal text-slate-400">(Optional)</span>
            <textarea
              rows={3}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              maxLength={5000}
              disabled={isSubmitting}
              placeholder="Customer address"
              className={`${inputClass} resize-y`}
            />
          </label>
        </div>
      </form>
    </ModalDialog>
  );
}
