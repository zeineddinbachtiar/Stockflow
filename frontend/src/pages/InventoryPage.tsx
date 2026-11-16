import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import {
  adjustStock,
  getInventory,
  getInventoryById,
  issueStock,
  receiveStock,
  updateReorderLevel,
} from "../features/inventory/inventory.api";
import InventoryOperationDialog, {
  type InventoryOperation,
} from "../features/inventory/InventoryOperationDialog";
import type {
  InventoryBalance,
  InventoryOperationResult,
  InventoryQueryParams,
  ReorderLevelPayload,
  StockAdjustmentPayload,
  StockOperationPayload,
} from "../features/inventory/inventory.types";
import { getProducts } from "../features/products/product.api";
import { getWarehouses } from "../features/warehouses/warehouse.api";

const PAGE_SIZE = 10;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatQuantity(value: number): string {
  return value.toLocaleString("id-ID");
}

export default function InventoryPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const canMutate = user?.role === "ADMIN" || user?.role === "WAREHOUSE_STAFF";

  const [offset, setOffset] = useState(0);
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [selectedInventory, setSelectedInventory] =
    useState<InventoryBalance | null>(null);
  const [operation, setOperation] = useState<InventoryOperation | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const inventoryParams: InventoryQueryParams = {
    warehouseId: warehouseId || undefined,
    productId: productId || undefined,
    lowStock: lowStock ? true : undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const inventoryQuery = useQuery({
    queryKey: ["inventory", inventoryParams],
    queryFn: () => getInventory(accessToken!, inventoryParams),
    enabled: Boolean(accessToken),
    placeholderData: (previousData) => previousData,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "inventory-options"],
    queryFn: () => getWarehouses(accessToken!, 100, 0),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "inventory-options"],
    queryFn: () => getProducts(accessToken!, { limit: 100, offset: 0 }),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  const detailQuery = useQuery({
    queryKey: ["inventory-detail", selectedInventory?.id],
    queryFn: () => getInventoryById(accessToken!, selectedInventory!.id),
    enabled: Boolean(accessToken && selectedInventory),
  });

  const mutation = useMutation<
    InventoryOperationResult | InventoryBalance,
    Error,
    StockOperationPayload | StockAdjustmentPayload | ReorderLevelPayload
  >({
    mutationFn: (
      payload:
        StockOperationPayload | StockAdjustmentPayload | ReorderLevelPayload,
    ) => {
      if (!accessToken || !operation) {
        throw new Error("Your session is unavailable. Please log in again.");
      }

      if (operation === "receipt") {
        return receiveStock(accessToken, payload as StockOperationPayload);
      }
      if (operation === "issue") {
        return issueStock(accessToken, payload as StockOperationPayload);
      }
      if (operation === "adjustment") {
        return adjustStock(accessToken, payload as StockAdjustmentPayload);
      }

      if (!selectedInventory) {
        throw new Error("Select an inventory balance first.");
      }

      return updateReorderLevel(
        accessToken,
        selectedInventory.id,
        payload as ReorderLevelPayload,
      );
    },
    onMutate: () => {
      setOperationError(null);
      setSuccessMessage(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-detail"] });
      setOperation(null);
      setSelectedInventory(null);
      setOperationError(null);
      setSuccessMessage("Inventory updated successfully.");
    },
    onError: (error: Error) => setOperationError(error.message),
  });

  const inventory = inventoryQuery.data?.inventory ?? [];
  const total = inventoryQuery.data?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isRequestError = inventoryQuery.isError && inventory.length === 0;

  function resetFilters() {
    setWarehouseId("");
    setProductId("");
    setLowStock(false);
    setOffset(0);
  }

  function openOperation(
    nextOperation: InventoryOperation,
    item?: InventoryBalance,
  ) {
    setOperationError(null);
    setSuccessMessage(null);
    setSelectedInventory(item ?? null);
    setOperation(nextOperation);
  }

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">Operations</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Inventory
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Monitor stock balances across your warehouses.
          </p>
        </div>

        {canMutate && (
          <button
            type="button"
            onClick={() => openOperation("receipt")}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={17} /> Receive Stock
          </button>
        )}
      </section>

      {successMessage && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {successMessage}
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss success message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h2 className="font-semibold text-slate-900">Inventory Balances</h2>
            <p className="mt-1 text-sm text-slate-500">
              Filter stock by warehouse, product, or low-stock status.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-500">
              Warehouse
              <select
                value={warehouseId}
                onChange={(event) => {
                  setWarehouseId(event.target.value);
                  setOffset(0);
                }}
                className="mt-1 block min-w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
              >
                <option value="">All warehouses</option>
                {warehousesQuery.data?.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Product
              <select
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setOffset(0);
                }}
                className="mt-1 block min-w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
              >
                <option value="">All products</option>
                {productsQuery.data?.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={lowStock}
                onChange={(event) => {
                  setLowStock(event.target.checked);
                  setOffset(0);
                }}
              />{" "}
              Low stock
            </label>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={15} /> Reset
            </button>
          </div>
        </div>

        {isRequestError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            <AlertCircle size={19} className="mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load inventory</p>
              <p className="mt-1 text-sm">
                {inventoryQuery.error instanceof Error
                  ? inventoryQuery.error.message
                  : "An unexpected error occurred."}
              </p>
              <button
                type="button"
                onClick={() => void inventoryQuery.refetch()}
                className="mt-2 text-sm font-semibold underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!isRequestError && (
          <>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-3 font-semibold">Warehouse</th>
                    <th className="px-3 py-3 font-semibold">Product</th>
                    <th className="px-3 py-3 font-semibold">On hand</th>
                    <th className="px-3 py-3 font-semibold">Reorder level</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryQuery.isPending &&
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={6} className="px-3 py-3">
                          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                        </td>
                      </tr>
                    ))}
                  {!inventoryQuery.isPending &&
                    inventory.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-50 hover:bg-slate-50/70"
                      >
                        <td className="px-3 py-4">
                          <p className="font-semibold text-slate-800">
                            {item.warehouseName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.warehouseCode}
                          </p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-semibold text-slate-800">
                            {item.productName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.productSku}
                          </p>
                        </td>
                        <td className="px-3 py-4 font-semibold text-slate-800">
                          {formatQuantity(item.quantityOnHand)}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {formatQuantity(item.reorderLevel)}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.isLowStock ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                          >
                            {item.isLowStock ? "Low stock" : "Healthy"}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedInventory(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              <Eye size={14} /> View
                            </button>
                            {canMutate && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openOperation("issue", item)}
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Issue
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openOperation("adjustment", item)
                                  }
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Adjust
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Update reorder level for ${item.productName}`}
                                  onClick={() => openOperation("reorder", item)}
                                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                                >
                                  <Settings2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!inventoryQuery.isPending && inventory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-16">
                        <div className="flex flex-col items-center text-center">
                          <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
                            <Package size={28} />
                          </div>
                          <p className="mt-4 font-semibold text-slate-800">
                            No inventory records found
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Try changing the filters or receive stock into a
                            warehouse.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!inventoryQuery.isPending && total > 0 && (
              <div className="mt-5 flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                <p className="text-sm text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {offset + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-slate-700">
                    {Math.min(offset + PAGE_SIZE, total)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700">{total}</span>{" "}
                  balances
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={offset === 0}
                    onClick={() =>
                      setOffset((current) => Math.max(0, current - PAGE_SIZE))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <span className="px-2 text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => setOffset((current) => current + PAGE_SIZE)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 disabled:opacity-40"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {selectedInventory && !operation && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-labelledby="inventory-detail-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="inventory-detail-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Inventory Detail
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedInventory.productName} at{" "}
                  {selectedInventory.warehouseName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInventory(null)}
                aria-label="Close detail"
              >
                <X size={18} />
              </button>
            </div>
            {detailQuery.isPending && (
              <div className="mt-6 h-24 animate-pulse rounded-lg bg-slate-100" />
            )}
            {detailQuery.isError && (
              <div
                role="alert"
                className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                <p>Unable to load inventory detail.</p>
                <button
                  type="button"
                  onClick={() => void detailQuery.refetch()}
                  className="mt-2 font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}
            {detailQuery.data && (
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500">Warehouse</dt>
                  <dd className="font-semibold text-slate-800">
                    {detailQuery.data.warehouseCode} —{" "}
                    {detailQuery.data.warehouseName}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Product</dt>
                  <dd className="font-semibold text-slate-800">
                    {detailQuery.data.productSku}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Quantity on hand</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatQuantity(detailQuery.data.quantityOnHand)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Reorder level</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatQuantity(detailQuery.data.reorderLevel)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500">Last updated</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatDate(detailQuery.data.updatedAt)}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      )}

      {operation && (
        <InventoryOperationDialog
          mode={operation}
          inventory={selectedInventory ?? undefined}
          warehouses={warehousesQuery.data?.warehouses ?? []}
          products={productsQuery.data?.products ?? []}
          isSubmitting={mutation.isPending}
          submitError={operationError}
          onClose={() => {
            if (!mutation.isPending) {
              setOperation(null);
              setOperationError(null);
            }
          }}
          onSubmit={(payload) => mutation.mutate(payload)}
        />
      )}
    </div>
  );
}
