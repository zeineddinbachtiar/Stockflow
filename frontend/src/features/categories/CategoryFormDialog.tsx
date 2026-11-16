import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import ModalDialog from "../../components/ui/ModalDialog";

import type { Category, CategoryPayload } from "./category.types";

interface CategoryFormDialogProps {
  mode: "create" | "edit";
  category?: Category;
  isSubmitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onSubmit: (payload: CategoryPayload) => void;
}

export default function CategoryFormDialog({
  mode,
  category,
  isSubmitting,
  submitError,
  onClose,
  onSubmit,
}: CategoryFormDialogProps) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    const normalizedName = name.trim();
    const normalizedDescription = description.trim();

    if (!normalizedName) {
      setValidationError("Category name is required.");
      return;
    }

    if (normalizedName.length > 100) {
      setValidationError("Category name must not exceed 100 characters.");
      return;
    }

    if (normalizedDescription.length > 2000) {
      setValidationError(
        "Category description must not exceed 2000 characters.",
      );
      return;
    }

    onSubmit({
      name: normalizedName,
      description: normalizedDescription || null,
    });
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50";

  return (
    <ModalDialog
      title={mode === "create" ? "Add Category" : "Edit Category"}
      closeLabel="Close category form"
      closeDisabled={isSubmitting}
      description={
        mode === "create"
          ? "Create a new product category."
          : "Update category information."
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
            form="category-form"
            disabled={isSubmitting}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? "Saving..."
              : mode === "create"
                ? "Create Category"
                : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit}>
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
              htmlFor="category-name"
              className="text-sm font-semibold text-slate-700"
            >
              Category Name
            </label>

            <input
              id="category-name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Office Equipment"
              disabled={isSubmitting}
              className={inputClass}
            />

            <p className="mt-1 text-right text-xs text-slate-400">
              {name.length}/100
            </p>
          </div>

          <div>
            <label
              htmlFor="category-description"
              className="text-sm font-semibold text-slate-700"
            >
              Description
              <span className="ml-1 font-normal text-slate-400">
                (Optional)
              </span>
            </label>

            <textarea
              id="category-description"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe this category..."
              disabled={isSubmitting}
              className={`${inputClass} resize-y`}
            />

            <p className="mt-1 text-right text-xs text-slate-400">
              {description.length}/2000
            </p>
          </div>
        </div>
      </form>
    </ModalDialog>
  );
}
