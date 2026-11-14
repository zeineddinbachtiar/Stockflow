import { useState, type FormEvent } from "react";
import { AlertCircle, X } from "lucide-react";

import type { Category, Product, ProductPayload } from "./product.types";

interface ProductFormDialogProps {
  mode: "create" | "edit";
  product?: Product;
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onSubmit: (payload: ProductPayload) => void;
}

const PRICE_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export default function ProductFormDialog({
  mode,
  product,
  categories,
  categoriesLoading,
  categoriesError,
  isSubmitting,
  submitError,
  onClose,
  onSubmit,
}: ProductFormDialogProps) {
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [unitPrice, setUnitPrice] = useState(product?.unitPrice ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (!categoryId) {
      setValidationError("Please select a product category.");
      return;
    }

    if (!sku.trim() || !name.trim()) {
      setValidationError("SKU and product name are required.");
      return;
    }

    const normalizedPrice = unitPrice.trim();

    if (!PRICE_PATTERN.test(normalizedPrice)) {
      setValidationError(
        "Enter a valid non-negative price with up to 2 decimal places.",
      );
      return;
    }

    onSubmit({
      categoryId,
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || null,
      unitPrice: normalizedPrice,
    });
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2
              id="product-form-title"
              className="text-lg font-bold text-slate-900"
            >
              {mode === "create" ? "Add Product" : "Edit Product"}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {mode === "create"
                ? "Add a new item to your product catalog."
                : "Update product information."}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close product form"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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
                htmlFor="product-category"
                className="text-sm font-semibold text-slate-700"
              >
                Category
              </label>

              <select
                id="product-category"
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={
                  isSubmitting ||
                  categoriesLoading ||
                  Boolean(categoriesError) ||
                  categories.length === 0
                }
                className={inputClass}
              >
                <option value="">Select a category</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              {categoriesLoading && (
                <p className="mt-1.5 text-xs text-slate-400">
                  Loading categories...
                </p>
              )}

              {categoriesError && (
                <p className="mt-1.5 text-xs text-red-600">
                  Unable to load categories: {categoriesError}
                </p>
              )}

              {!categoriesLoading &&
                !categoriesError &&
                categories.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    An active category is required before adding a product.
                  </p>
                )}
            </div>

            <div>
              <label
                htmlFor="product-sku"
                className="text-sm font-semibold text-slate-700"
              >
                SKU
              </label>

              <input
                id="product-sku"
                required
                maxLength={50}
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="e.g. LAP-003"
                disabled={isSubmitting}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="product-name"
                className="text-sm font-semibold text-slate-700"
              >
                Product Name
              </label>

              <input
                id="product-name"
                required
                maxLength={150}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter product name"
                disabled={isSubmitting}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="product-price"
                className="text-sm font-semibold text-slate-700"
              >
                Unit Price
              </label>

              <input
                id="product-price"
                type="text"
                inputMode="decimal"
                required
                maxLength={15}
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                placeholder="e.g. 14999000.00"
                disabled={isSubmitting}
                className={inputClass}
              />

              <p className="mt-1.5 text-xs text-slate-400">
                Use a period for decimals. Maximum 2 decimal places.
              </p>
            </div>

            <div>
              <label
                htmlFor="product-description"
                className="text-sm font-semibold text-slate-700"
              >
                Description
                <span className="ml-1 font-normal text-slate-400">
                  (Optional)
                </span>
              </label>

              <textarea
                id="product-description"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe this product..."
                disabled={isSubmitting}
                className={`${inputClass} resize-y`}
              />

              <p className="mt-1 text-right text-xs text-slate-400">
                {description.length}/2000
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
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
              disabled={
                isSubmitting ||
                categoriesLoading ||
                Boolean(categoriesError) ||
                categories.length === 0
              }
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : mode === "create"
                  ? "Create Product"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
