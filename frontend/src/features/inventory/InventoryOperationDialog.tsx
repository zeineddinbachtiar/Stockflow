import { useRef, useState } from "react";
import type { FormEvent } from "react";
import useModalDialog from "../../components/ui/useModalDialog";
import QueryStateMessage from "../../components/ui/QueryStateMessage";
import type { Product } from "../products/product.types";
import type { Warehouse } from "../warehouses/warehouse.types";
import type {
  InventoryBalance,
  ReorderLevelPayload,
  StockAdjustmentPayload,
  StockOperationPayload,
} from "./inventory.types";

export type InventoryOperation = "receipt" | "issue" | "adjustment" | "reorder";

interface InventoryOperationDialogProps {
  mode: InventoryOperation;
  inventory?: InventoryBalance;
  warehouses: Warehouse[];
  products: Product[];
  warehousesLoading: boolean;
  productsLoading: boolean;
  warehousesError: string | null;
  productsError: string | null;
  onRetryWarehouses?: () => void;
  onRetryProducts?: () => void;
  isSubmitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onSubmit: (
    payload:
      StockOperationPayload | StockAdjustmentPayload | ReorderLevelPayload,
  ) => void;
}

const titles: Record<InventoryOperation, string> = {
  receipt: "Receive Stock",
  issue: "Issue Stock",
  adjustment: "Adjust Stock",
  reorder: "Update Reorder Level",
};

export default function InventoryOperationDialog({
  mode,
  inventory,
  warehouses,
  products,
  warehousesLoading,
  productsLoading,
  warehousesError,
  productsError,
  onRetryWarehouses,
  onRetryProducts,
  isSubmitting,
  submitError,
  onClose,
  onSubmit,
}: InventoryOperationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDialog(dialogRef, onClose);

  const [warehouseId, setWarehouseId] = useState(inventory?.warehouseId ?? "");
  const [productId, setProductId] = useState(inventory?.productId ?? "");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reorderLevel, setReorderLevel] = useState(
    inventory ? String(inventory.reorderLevel) : "0",
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const isReorder = mode === "reorder";
  const optionsUnavailable =
    !isReorder &&
    (warehousesLoading ||
      productsLoading ||
      Boolean(warehousesError) ||
      Boolean(productsError) ||
      warehouses.length === 0 ||
      products.length === 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (isReorder) {
      const value = Number(reorderLevel);
      if (!Number.isInteger(value) || value < 0) {
        setValidationError(
          "Reorder level must be a whole number of 0 or more.",
        );
        return;
      }

      onSubmit({ reorderLevel: value });
      return;
    }

    if (!warehouseId || !productId) {
      setValidationError("Select a warehouse and product.");
      return;
    }

    const value = Number(quantity);
    if (!Number.isInteger(value) || (mode !== "adjustment" && value <= 0)) {
      setValidationError(
        mode === "adjustment"
          ? "Quantity delta must be a non-zero whole number."
          : "Quantity must be a positive whole number.",
      );
      return;
    }

    if (mode === "adjustment") {
      const delta = Number(quantity);
      if (delta === 0) {
        setValidationError("Adjustment cannot be zero.");
        return;
      }

      if (!reason.trim()) {
        setValidationError("A reason is required for an adjustment.");
        return;
      }

      onSubmit({
        warehouseId,
        productId,
        quantityDelta: delta,
        reason: reason.trim(),
      });
      return;
    }

    onSubmit({
      warehouseId,
      productId,
      quantity: value,
      reason: reason.trim() || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-operation-title"
        aria-describedby="inventory-operation-description"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="inventory-operation-title"
              className="text-xl font-bold text-slate-900"
            >
              {titles[mode]}
            </h2>
            <p
              id="inventory-operation-description"
              className="mt-1 text-sm text-slate-500"
            >
              {isReorder
                ? `Update ${inventory?.productName ?? "this inventory balance"}.`
                : "Record the stock movement using the active warehouse and product."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {!isReorder && (
            <>
              <label className="block text-sm font-medium text-slate-700">
                Warehouse
                <select
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  disabled={isSubmitting || optionsUnavailable}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} — {warehouse.name}
                    </option>
                  ))}
                </select>
                <QueryStateMessage
                  resource="warehouses"
                  isLoading={warehousesLoading}
                  isError={Boolean(warehousesError)}
                  isEmpty={warehouses.length === 0}
                  errorMessage={warehousesError ?? undefined}
                  onRetry={onRetryWarehouses}
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Product
                <select
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  disabled={isSubmitting || optionsUnavailable}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} — {product.name}
                    </option>
                  ))}
                </select>
                <QueryStateMessage
                  resource="products"
                  isLoading={productsLoading}
                  isError={Boolean(productsError)}
                  isEmpty={products.length === 0}
                  errorMessage={productsError ?? undefined}
                  onRetry={onRetryProducts}
                />
              </label>
            </>
          )}

          <label className="block text-sm font-medium text-slate-700">
            {isReorder
              ? "Reorder level"
              : mode === "adjustment"
                ? "Quantity delta"
                : "Quantity"}
            <input
              type="number"
              min={mode === "adjustment" ? undefined : 0}
              step="1"
              value={isReorder ? reorderLevel : quantity}
              onChange={(event) =>
                isReorder
                  ? setReorderLevel(event.target.value)
                  : setQuantity(event.target.value)
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          {!isReorder && (
            <label className="block text-sm font-medium text-slate-700">
              Reason {mode === "adjustment" ? "(required)" : "(optional)"}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={2000}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          )}

          {(validationError || submitError) && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {validationError ?? submitError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || optionsUnavailable}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
