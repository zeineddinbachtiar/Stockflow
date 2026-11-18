import { useState } from "react";
import type { FormEvent } from "react";
import ModalDialog from "../../components/ui/ModalDialog";
import QueryStateMessage from "../../components/ui/QueryStateMessage";
import LoadMoreOptions from "../../components/ui/LoadMoreOptions";
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
  hasMoreWarehouses?: boolean;
  loadingMoreWarehouses?: boolean;
  warehousesPageError?: string | null;
  onLoadMoreWarehouses?: () => void;
  hasMoreProducts?: boolean;
  loadingMoreProducts?: boolean;
  productsPageError?: string | null;
  onLoadMoreProducts?: () => void;
  productSearch?: string;
  onProductSearchChange?: (value: string) => void;
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
  hasMoreWarehouses = false,
  loadingMoreWarehouses = false,
  warehousesPageError = null,
  onLoadMoreWarehouses,
  hasMoreProducts = false,
  loadingMoreProducts = false,
  productsPageError = null,
  onLoadMoreProducts,
  productSearch = "",
  onProductSearchChange,
  isSubmitting,
  submitError,
  onClose,
  onSubmit,
}: InventoryOperationDialogProps) {
  const [warehouseId, setWarehouseId] = useState(inventory?.warehouseId ?? "");
  const [productId, setProductId] = useState(inventory?.productId ?? "");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reorderLevel, setReorderLevel] = useState(
    inventory ? String(inventory.reorderLevel) : "0",
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const isReorder = mode === "reorder";
  const isInactiveClearance =
    Boolean(inventory && !inventory.productIsActive) &&
    (mode === "issue" || mode === "adjustment");
  const optionsUnavailable =
    !isReorder &&
    (warehousesLoading ||
      Boolean(warehousesError) ||
      warehouses.length === 0 ||
      (!isInactiveClearance &&
        (productsLoading || Boolean(productsError) || products.length === 0)));

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

      if (isInactiveClearance && delta > 0) {
        setValidationError(
          "Inactive products only allow negative stock adjustments.",
        );
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
    <ModalDialog
      title={titles[mode]}
      closeLabel="Close inventory operation"
      closeDisabled={isSubmitting}
      description={
        isInactiveClearance
          ? `Clear remaining stock for inactive product ${inventory?.productSku} — ${inventory?.productName}.`
          : isReorder
            ? `Update ${inventory?.productName ?? "this inventory balance"}.`
            : "Record the stock movement using the active warehouse and product."
      }
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="inventory-operation-form"
            disabled={isSubmitting || optionsUnavailable}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <form
        id="inventory-operation-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {!isReorder && (
          <>
            <label className="block text-sm font-semibold text-slate-700">
              Warehouse
              <select
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                disabled={
                  isSubmitting || optionsUnavailable || isInactiveClearance
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
                {inventory &&
                  !warehouses.some(
                    (warehouse) => warehouse.id === inventory.warehouseId,
                  ) && (
                    <option value={inventory.warehouseId}>
                      {inventory.warehouseCode} — {inventory.warehouseName}
                    </option>
                  )}
              </select>
              <QueryStateMessage
                resource="warehouses"
                isLoading={warehousesLoading}
                isError={Boolean(warehousesError)}
                isEmpty={warehouses.length === 0}
                errorMessage={warehousesError ?? undefined}
                onRetry={onRetryWarehouses}
              />
              <LoadMoreOptions
                resource="warehouses"
                hasMore={hasMoreWarehouses}
                isLoading={loadingMoreWarehouses}
                error={warehousesPageError}
                onLoadMore={() => onLoadMoreWarehouses?.()}
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Product
              {!isInactiveClearance && (
                <input
                  type="search"
                  aria-label="Search products"
                  value={productSearch}
                  onChange={(event) =>
                    onProductSearchChange?.(event.target.value)
                  }
                  placeholder="Search by SKU or product name"
                  disabled={isSubmitting}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
                />
              )}
              <select
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setSelectedProduct(
                    products.find(
                      (product) => product.id === event.target.value,
                    ) ?? null,
                  );
                }}
                disabled={
                  isSubmitting || optionsUnavailable || isInactiveClearance
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} — {product.name}
                  </option>
                ))}
                {isInactiveClearance &&
                  inventory &&
                  !products.some(
                    (product) => product.id === inventory.productId,
                  ) && (
                    <option value={inventory.productId}>
                      {inventory.productSku} — {inventory.productName}{" "}
                      {!inventory.productIsActive && "(Inactive)"}
                    </option>
                  )}
                {!isInactiveClearance &&
                  inventory &&
                  !products.some(
                    (product) => product.id === inventory.productId,
                  ) && (
                    <option value={inventory.productId}>
                      {inventory.productSku} — {inventory.productName}
                    </option>
                  )}
                {!isInactiveClearance &&
                  selectedProduct &&
                  selectedProduct.id === productId &&
                  !products.some((product) => product.id === productId) &&
                  !inventory && (
                    <option value={productId}>
                      {selectedProduct.sku} — {selectedProduct.name}
                    </option>
                  )}
              </select>
              {isInactiveClearance ? (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                  Inactive product — only stock clearance is allowed.
                </p>
              ) : (
                <QueryStateMessage
                  resource="products"
                  isLoading={productsLoading}
                  isError={Boolean(productsError)}
                  isEmpty={products.length === 0}
                  errorMessage={productsError ?? undefined}
                  onRetry={onRetryProducts}
                />
              )}
              {!isInactiveClearance && (
                <LoadMoreOptions
                  resource="products"
                  hasMore={hasMoreProducts}
                  isLoading={loadingMoreProducts}
                  error={productsPageError}
                  onLoadMore={() => onLoadMoreProducts?.()}
                />
              )}
            </label>
          </>
        )}

        <label className="block text-sm font-semibold text-slate-700">
          {isReorder
            ? "Reorder level"
            : mode === "adjustment"
              ? "Quantity delta"
              : "Quantity"}
          <input
            type="number"
            min={mode === "adjustment" ? undefined : 0}
            max={isInactiveClearance && mode === "adjustment" ? 0 : undefined}
            step="1"
            value={isReorder ? reorderLevel : quantity}
            onChange={(event) =>
              isReorder
                ? setReorderLevel(event.target.value)
                : setQuantity(event.target.value)
            }
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
          />
        </label>

        {!isReorder && (
          <label className="block text-sm font-semibold text-slate-700">
            Reason {mode === "adjustment" ? "(required)" : "(optional)"}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
            />
          </label>
        )}

        {(validationError || submitError) && (
          <p
            role="alert"
            aria-live="assertive"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {validationError ?? submitError}
          </p>
        )}
      </form>
    </ModalDialog>
  );
}
