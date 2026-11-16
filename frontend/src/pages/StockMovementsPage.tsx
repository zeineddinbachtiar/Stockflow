import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  X,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import useModalDialog from "../components/ui/useModalDialog";
import QueryStateMessage from "../components/ui/QueryStateMessage";
import type {
  StockMovement,
  StockMovementType,
} from "../features/inventory/inventory.types";
import { getProducts } from "../features/products/product.api";
import {
  getStockMovementById,
  getStockMovements,
} from "../features/stock-movements/stock-movement.api";
import { getWarehouses } from "../features/warehouses/warehouse.api";

const PAGE_SIZE = 10;

const movementTypes: Array<{ value: StockMovementType; label: string }> = [
  { value: "RECEIPT", label: "Receipt" },
  { value: "ISSUE", label: "Issue" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "ORDER_CONFIRM", label: "Order confirmation" },
  { value: "ORDER_CANCEL", label: "Order cancellation" },
];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatQuantity(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("id-ID")}`;
}

function movementLabel(type: StockMovementType): string {
  return (
    movementTypes.find((movement) => movement.value === type)?.label ?? type
  );
}

function movementTone(type: StockMovementType): string {
  if (type === "RECEIPT" || type === "ORDER_CANCEL") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (type === "ISSUE" || type === "ORDER_CONFIRM") {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-blue-50 text-blue-700";
}

export default function StockMovementsPage() {
  const { accessToken } = useAuth();
  const [offset, setOffset] = useState(0);
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [movementType, setMovementType] = useState<StockMovementType | "">("");
  const [selectedMovement, setSelectedMovement] =
    useState<StockMovement | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const closeDetail = useCallback(() => setSelectedMovement(null), []);
  useModalDialog(detailRef, closeDetail, Boolean(selectedMovement));

  const queryParams = {
    warehouseId: warehouseId || undefined,
    productId: productId || undefined,
    movementType: movementType || undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const movementsQuery = useQuery({
    queryKey: ["stock-movements", queryParams],
    queryFn: () => getStockMovements(accessToken!, queryParams),
    enabled: Boolean(accessToken),
    placeholderData: (previousData) => previousData,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "stock-movement-options"],
    queryFn: () => getWarehouses(accessToken!, 100, 0),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "stock-movement-options"],
    queryFn: () => getProducts(accessToken!, { limit: 100, offset: 0 }),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  const detailQuery = useQuery({
    queryKey: ["stock-movement-detail", selectedMovement?.id],
    queryFn: () => getStockMovementById(accessToken!, selectedMovement!.id),
    enabled: Boolean(accessToken && selectedMovement),
  });

  const movements = movementsQuery.data?.movements ?? [];
  const total = movementsQuery.data?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isRequestError = movementsQuery.isError && movements.length === 0;

  function resetFilters() {
    setWarehouseId("");
    setProductId("");
    setMovementType("");
    setOffset(0);
  }

  return (
    <div className="space-y-7">
      <section>
        <p className="text-sm font-medium text-blue-600">Operations</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Stock Movements
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Review receipts, issues, adjustments, and stock history.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h2 className="font-semibold text-slate-900">Movement History</h2>
            <p className="mt-1 text-sm text-slate-500">
              Read-only audit history for warehouse stock changes.
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
                disabled={warehousesQuery.isPending || warehousesQuery.isError}
                className="mt-1 block min-w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
              >
                <option value="">All warehouses</option>
                {warehousesQuery.data?.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code}
                  </option>
                ))}
              </select>
              <QueryStateMessage
                resource="warehouses"
                isLoading={warehousesQuery.isPending}
                isError={warehousesQuery.isError}
                isEmpty={warehousesQuery.data?.warehouses.length === 0}
                errorMessage={
                  warehousesQuery.error instanceof Error
                    ? warehousesQuery.error.message
                    : undefined
                }
                onRetry={() => void warehousesQuery.refetch()}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Product
              <select
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setOffset(0);
                }}
                disabled={productsQuery.isPending || productsQuery.isError}
                className="mt-1 block min-w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
              >
                <option value="">All products</option>
                {productsQuery.data?.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku}
                  </option>
                ))}
              </select>
              <QueryStateMessage
                resource="products"
                isLoading={productsQuery.isPending}
                isError={productsQuery.isError}
                isEmpty={productsQuery.data?.products.length === 0}
                errorMessage={
                  productsQuery.error instanceof Error
                    ? productsQuery.error.message
                    : undefined
                }
                onRetry={() => void productsQuery.refetch()}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Movement type
              <select
                value={movementType}
                onChange={(event) => {
                  setMovementType(event.target.value as StockMovementType | "");
                  setOffset(0);
                }}
                className="mt-1 block min-w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
              >
                <option value="">All types</option>
                {movementTypes.map((movement) => (
                  <option key={movement.value} value={movement.value}>
                    {movement.label}
                  </option>
                ))}
              </select>
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
              <p className="font-semibold">Unable to load stock movements</p>
              <p className="mt-1 text-sm">
                {movementsQuery.error instanceof Error
                  ? movementsQuery.error.message
                  : "An unexpected error occurred."}
              </p>
              <button
                type="button"
                onClick={() => void movementsQuery.refetch()}
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
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Type</th>
                    <th className="px-3 py-3 font-semibold">Warehouse</th>
                    <th className="px-3 py-3 font-semibold">Product</th>
                    <th className="px-3 py-3 font-semibold">Quantity</th>
                    <th className="px-3 py-3 font-semibold">Reason</th>
                    <th className="px-3 py-3 font-semibold">Reference</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movementsQuery.isPending &&
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={8} className="px-3 py-3">
                          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                        </td>
                      </tr>
                    ))}
                  {!movementsQuery.isPending &&
                    movements.map((movement) => (
                      <tr
                        key={movement.id}
                        className="border-b border-slate-50 hover:bg-slate-50/70"
                      >
                        <td className="whitespace-nowrap px-3 py-4 text-slate-500">
                          {formatDate(movement.createdAt)}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${movementTone(movement.movementType)}`}
                          >
                            {movementLabel(movement.movementType)}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-semibold text-slate-800">
                            {movement.warehouseName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {movement.warehouseCode}
                          </p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-semibold text-slate-800">
                            {movement.productName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {movement.productSku}
                          </p>
                        </td>
                        <td
                          className={`px-3 py-4 font-semibold ${movement.quantityDelta >= 0 ? "text-emerald-700" : "text-red-700"}`}
                        >
                          {formatQuantity(movement.quantityDelta)}
                        </td>
                        <td className="max-w-xs px-3 py-4 text-slate-600">
                          {movement.reason || "—"}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {movement.orderId
                            ? `Order #${movement.orderId}`
                            : "Manual movement"}
                        </td>
                        <td className="px-3 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedMovement(movement)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <Eye size={14} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  {!movementsQuery.isPending && movements.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-16">
                        <div className="flex flex-col items-center text-center">
                          <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
                            <Activity size={28} />
                          </div>
                          <p className="mt-4 font-semibold text-slate-800">
                            No stock movements found
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Movement history will appear after stock or order
                            activity.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!movementsQuery.isPending && total > 0 && (
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
                  movements
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

      {selectedMovement && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
          <div
            ref={detailRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-movement-detail-title"
            aria-describedby="stock-movement-detail-description"
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="stock-movement-detail-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Stock Movement Detail
                </h2>
                <p
                  id="stock-movement-detail-description"
                  className="mt-1 text-sm text-slate-500"
                >
                  Read-only audit information
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Close detail"
              >
                <X size={18} />
              </button>
            </div>
            {detailQuery.isPending && (
              <div className="mt-6 h-32 animate-pulse rounded-lg bg-slate-100" />
            )}
            {detailQuery.isError && (
              <div
                role="alert"
                className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                <p>Unable to load stock movement detail.</p>
                <button
                  type="button"
                  onClick={() => void detailQuery.refetch()}
                  className="mt-2 font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}
            {detailQuery.data && <MovementDetail movement={detailQuery.data} />}
          </div>
        </div>
      )}
    </div>
  );
}

function MovementDetail({ movement }: { movement: StockMovement }) {
  return (
    <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
      <div>
        <dt className="text-slate-500">Movement type</dt>
        <dd className="font-semibold text-slate-800">
          {movementLabel(movement.movementType)}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Quantity delta</dt>
        <dd className="font-semibold text-slate-800">
          {formatQuantity(movement.quantityDelta)}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Warehouse</dt>
        <dd className="font-semibold text-slate-800">
          {movement.warehouseCode} — {movement.warehouseName}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Product</dt>
        <dd className="font-semibold text-slate-800">
          {movement.productSku} — {movement.productName}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Performed by</dt>
        <dd className="font-semibold text-slate-800">
          {movement.performedByName}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Timestamp</dt>
        <dd className="font-semibold text-slate-800">
          {formatDate(movement.createdAt)}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Reason</dt>
        <dd className="font-semibold text-slate-800">
          {movement.reason || "—"}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Reference</dt>
        <dd className="font-semibold text-slate-800">
          {movement.orderId ? `Order #${movement.orderId}` : "Manual movement"}
        </dd>
      </div>
    </dl>
  );
}
