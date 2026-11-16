import { useState, type FormEvent } from "react";
import { AlertCircle, Minus, Plus } from "lucide-react";
import ModalDialog from "../../components/ui/ModalDialog";

import type { Customer } from "../customers/customer.types";
import type { Product } from "../products/product.types";
import type { Warehouse } from "../warehouses/warehouse.types";
import type {
  CreateOrderPayload,
  Order,
  OrderItemPayload,
  UpdateOrderPayload,
} from "./order.types";

interface OrderFormDialogProps {
  mode: "create" | "edit";
  order?: Order;
  customers: Customer[];
  warehouses: Warehouse[];
  products: Product[];
  isSubmitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateOrderPayload | UpdateOrderPayload) => void;
}

interface DraftItem extends OrderItemPayload {
  key: string;
}

function toDraftItems(order?: Order): DraftItem[] {
  return (
    order?.items?.map((item) => ({
      key: item.id,
      productId: item.productId,
      quantity: item.quantity,
    })) ?? [{ key: crypto.randomUUID(), productId: "", quantity: 1 }]
  );
}

function sameItems(
  left: OrderItemPayload[],
  right: OrderItemPayload[],
): boolean {
  if (left.length !== right.length) return false;

  return left.every(
    (item, index) =>
      item.productId === right[index]?.productId &&
      item.quantity === right[index]?.quantity,
  );
}

export default function OrderFormDialog({
  mode,
  order,
  customers,
  warehouses,
  products,
  isSubmitting,
  submitError,
  onClose,
  onSubmit,
}: OrderFormDialogProps) {
  const [customerId, setCustomerId] = useState(order?.customerId ?? "");
  const [warehouseId, setWarehouseId] = useState(order?.warehouseId ?? "");
  const [items, setItems] = useState<DraftItem[]>(() => toDraftItems(order));
  const [validationError, setValidationError] = useState<string | null>(null);

  function updateItem(
    key: string,
    field: "productId" | "quantity",
    value: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.key === key
          ? { ...item, [field]: field === "quantity" ? Number(value) : value }
          : item,
      ),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (!customerId || !warehouseId) {
      setValidationError("Select a customer and warehouse.");
      return;
    }

    if (items.length === 0 || items.some((item) => !item.productId)) {
      setValidationError("Add at least one product to the order.");
      return;
    }

    if (
      items.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 2147483647,
      )
    ) {
      setValidationError("Each quantity must be a positive whole number.");
      return;
    }

    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      setValidationError("A product can only appear once in an order.");
      return;
    }

    const normalizedItems = items.map(({ productId, quantity }) => ({
      productId,
      quantity,
    }));

    if (mode === "edit" && order) {
      const originalItems =
        order.items?.map(({ productId, quantity }) => ({
          productId,
          quantity,
        })) ?? [];
      const payload: UpdateOrderPayload = {};

      if (customerId !== order.customerId) payload.customerId = customerId;
      if (warehouseId !== order.warehouseId) payload.warehouseId = warehouseId;
      if (!sameItems(normalizedItems, originalItems)) {
        payload.items = normalizedItems;
      }

      if (Object.keys(payload).length === 0) {
        setValidationError("Change at least one order field before saving.");
        return;
      }

      onSubmit(payload);
      return;
    }

    onSubmit({ customerId, warehouseId, items: normalizedItems });
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50";

  return (
    <ModalDialog
      title={mode === "create" ? "Create Draft Order" : "Edit Draft Order"}
      closeLabel="Close order form"
      closeDisabled={isSubmitting}
      description="Product prices are calculated by the backend."
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      maxWidth="max-w-3xl"
      footer={
        <>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="order-form"
            disabled={isSubmitting}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting
              ? "Saving..."
              : mode === "create"
                ? "Create Draft"
                : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="order-form" onSubmit={submit}>
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

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Customer
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                disabled={isSubmitting}
                className={inputClass}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customerCode} — {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Warehouse
              <select
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                disabled={isSubmitting}
                className={inputClass}
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                Order items
              </h3>
              <button
                type="button"
                disabled={isSubmitting || items.length >= 100}
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    { key: crypto.randomUUID(), productId: "", quantity: 1 },
                  ])
                }
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-40"
              >
                <Plus size={14} /> Add item
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-end gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <label className="flex-1 text-xs font-semibold text-slate-500">
                    Product
                    <select
                      value={item.productId}
                      onChange={(event) =>
                        updateItem(item.key, "productId", event.target.value)
                      }
                      disabled={isSubmitting}
                      className={inputClass}
                    >
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} — {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-28 text-xs font-semibold text-slate-500">
                    Quantity
                    <input
                      type="number"
                      min="1"
                      max="2147483647"
                      step="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.key, "quantity", event.target.value)
                      }
                      disabled={isSubmitting}
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="button"
                    aria-label="Remove order item"
                    disabled={isSubmitting || items.length === 1}
                    onClick={() =>
                      setItems((current) =>
                        current.filter((entry) => entry.key !== item.key),
                      )
                    }
                    className="rounded-lg border border-slate-200 p-2.5 text-slate-500 disabled:opacity-40"
                  >
                    <Minus size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>
    </ModalDialog>
  );
}
