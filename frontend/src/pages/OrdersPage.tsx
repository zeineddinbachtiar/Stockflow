import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import { getCustomers } from "../features/customers/customer.api";
import { getProducts } from "../features/products/product.api";
import { getWarehouses } from "../features/warehouses/warehouse.api";
import OrderFormDialog from "../features/orders/OrderFormDialog";
import {
  cancelOrder,
  confirmOrder,
  createOrder,
  getOrderById,
  getOrders,
  updateOrder,
} from "../features/orders/order.api";
import type {
  CreateOrderPayload,
  Order,
  OrderQueryParams,
  OrderStatus,
  UpdateOrderPayload,
} from "../features/orders/order.types";

const PAGE_SIZE = 10;

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusClass(status: OrderStatus): string {
  if (status === "CONFIRMED") return "bg-emerald-50 text-emerald-700";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

export default function OrdersPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const canCreate = isAdmin || user?.role === "SALES_STAFF";
  const canConfirm = isAdmin || user?.role === "WAREHOUSE_STAFF";

  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [action, setAction] = useState<"confirm" | "cancel" | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const params: OrderQueryParams = {
    limit: PAGE_SIZE,
    offset,
    status: status || undefined,
    customerId: customerId.trim() || undefined,
    warehouseId: warehouseId || undefined,
  };

  const ordersQuery = useQuery({
    queryKey: ["orders", params],
    queryFn: () => getOrders(accessToken!, params),
    enabled: Boolean(accessToken),
    placeholderData: (previousData) => previousData,
  });

  const detailQuery = useQuery({
    queryKey: ["order-detail", selectedOrder?.id],
    queryFn: () => getOrderById(accessToken!, selectedOrder!.id),
    enabled: Boolean(accessToken && selectedOrder),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "order-options"],
    queryFn: () => getWarehouses(accessToken!, 100, 0),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "order-options"],
    queryFn: () => getCustomers(accessToken!, 100, 0),
    enabled: Boolean(
      accessToken && (canCreate || user?.role === "SALES_STAFF"),
    ),
    staleTime: 60_000,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "order-options"],
    queryFn: () => getProducts(accessToken!, { limit: 100, offset: 0 }),
    enabled: Boolean(accessToken && canCreate),
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: CreateOrderPayload | UpdateOrderPayload) => {
      if (!accessToken)
        throw new Error("Your session is unavailable. Please log in again.");
      if (formMode === "edit" && selectedOrder) {
        return updateOrder(
          accessToken,
          selectedOrder.id,
          payload as UpdateOrderPayload,
        );
      }
      return createOrder(accessToken, payload as CreateOrderPayload);
    },
    onMutate: () => {
      setOperationError(null);
      setSuccessMessage(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
      setFormMode(null);
      setSelectedOrder(null);
      setSuccessMessage("Draft order saved successfully.");
    },
    onError: (error: Error) => setOperationError(error.message),
  });

  const workflowMutation = useMutation({
    mutationFn: (nextAction: "confirm" | "cancel") => {
      if (!accessToken || !selectedOrder) {
        throw new Error("Select an order first.");
      }
      return nextAction === "confirm"
        ? confirmOrder(accessToken, selectedOrder.id)
        : cancelOrder(accessToken, selectedOrder.id);
    },
    onMutate: (nextAction) => {
      setAction(nextAction);
      setOperationError(null);
      setSuccessMessage(null);
    },
    onSuccess: async (_, nextAction) => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
      setAction(null);
      setSelectedOrder(null);
      setSuccessMessage(
        nextAction === "confirm" ? "Order confirmed." : "Order cancelled.",
      );
    },
    onError: (error: Error) => {
      setAction(null);
      setOperationError(error.message);
    },
  });

  const orders = ordersQuery.data?.orders ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const detail = detailQuery.data;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isInitialLoading = ordersQuery.isPending;
  const isRequestError = ordersQuery.isError && orders.length === 0;
  const isDetailDraft = detail?.status === "DRAFT";
  const canEditDetail = Boolean(
    detail &&
    isDetailDraft &&
    (isAdmin || (user?.role === "SALES_STAFF" && detail.createdBy === user.id)),
  );
  const canCancelDetail = Boolean(
    detail &&
    ((detail.status === "DRAFT" &&
      (isAdmin ||
        (user?.role === "SALES_STAFF" && detail.createdBy === user.id))) ||
      (detail.status === "CONFIRMED" && canConfirm)),
  );

  function resetFilters() {
    setStatus("");
    setCustomerId("");
    setWarehouseId("");
    setOffset(0);
  }

  function openDetail(order: Order) {
    setOperationError(null);
    setSelectedOrder(order);
  }

  function closeDetail() {
    if (!workflowMutation.isPending) {
      setSelectedOrder(null);
      setOperationError(null);
    }
  }

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">Sales</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Orders
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Create and manage sales orders and fulfillment workflows.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setOperationError(null);
              setFormMode("create");
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={17} /> Create Draft
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
            aria-label="Dismiss success message"
            onClick={() => setSuccessMessage(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}

      {operationError && !selectedOrder && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {operationError}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h2 className="font-semibold text-slate-900">Order Register</h2>
            <p className="mt-1 text-sm text-slate-500">
              Filter orders by status, customer, or warehouse.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-500">
              Status
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as OrderStatus | "");
                  setOffset(0);
                }}
                className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Customer ID
              {customersQuery.data ? (
                <select
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                    setOffset(0);
                  }}
                  className="mt-1 block min-w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
                >
                  <option value="">All customers</option>
                  {customersQuery.data.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.customerCode} — {customer.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                    setOffset(0);
                  }}
                  inputMode="numeric"
                  placeholder="Optional ID"
                  className="mt-1 block w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
                />
              )}
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Warehouse
              <select
                value={warehouseId}
                onChange={(event) => {
                  setWarehouseId(event.target.value);
                  setOffset(0);
                }}
                className="mt-1 block min-w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
              >
                <option value="">All warehouses</option>
                {warehousesQuery.data?.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code}
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
            <div className="flex-1">
              <p className="font-semibold">Unable to load orders</p>
              <p className="mt-1 text-sm">
                {ordersQuery.error instanceof Error
                  ? ordersQuery.error.message
                  : "An unexpected error occurred."}
              </p>
              <button
                type="button"
                onClick={() => void ordersQuery.refetch()}
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
                    <th className="px-3 py-3 font-semibold">Order</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold">Warehouse</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Total</th>
                    <th className="px-3 py-3 font-semibold">Ordered At</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isInitialLoading &&
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={7} className="px-3 py-3">
                          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                        </td>
                      </tr>
                    ))}
                  {!isInitialLoading &&
                    orders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-slate-50 hover:bg-slate-50/70"
                      >
                        <td className="px-3 py-4">
                          <p className="font-semibold text-slate-800">
                            {order.orderNumber}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {order.itemCount} item(s)
                          </p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-semibold text-slate-700">
                            {order.customerName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {order.customerCode}
                          </p>
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {order.warehouseCode}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-3 py-4 font-medium text-slate-700">
                          {formatMoney(order.totalAmount)}
                        </td>
                        <td className="px-3 py-4 text-slate-500">
                          {formatDate(order.orderedAt)}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => openDetail(order)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              <Eye size={14} /> View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!isInitialLoading && orders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-16">
                        <div className="flex flex-col items-center text-center">
                          <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
                            <FileText size={28} />
                          </div>
                          <p className="mt-4 font-semibold text-slate-800">
                            No orders found
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Try changing the filters or create a draft order.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!isInitialLoading && (
              <div className="mt-5 flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                <p className="text-sm text-slate-500">
                  {total === 0
                    ? "No orders to display"
                    : `Showing ${offset + 1} to ${Math.min(offset + orders.length, total)} of ${total} orders`}
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-2 text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={offset === 0 || ordersQuery.isFetching}
                    onClick={() =>
                      setOffset((current) => Math.max(0, current - PAGE_SIZE))
                    }
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={
                      offset + PAGE_SIZE >= total || ordersQuery.isFetching
                    }
                    onClick={() => setOffset((current) => current + PAGE_SIZE)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
            {ordersQuery.isFetching && !isInitialLoading && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw size={13} className="animate-spin" /> Updating order
                list...
              </div>
            )}
          </>
        )}
      </section>

      {selectedOrder && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-labelledby="order-detail-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="order-detail-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Order Detail
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedOrder.orderNumber}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close order detail"
                onClick={closeDetail}
              >
                <X size={18} />
              </button>
            </div>
            {detailQuery.isPending && (
              <div className="mt-6 h-48 animate-pulse rounded-lg bg-slate-100" />
            )}
            {detailQuery.isError && (
              <div
                role="alert"
                className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                <p>Unable to load order detail.</p>
                <button
                  type="button"
                  onClick={() => void detailQuery.refetch()}
                  className="mt-2 font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}
            {detail && (
              <>
                <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Customer</dt>
                    <dd className="font-semibold text-slate-800">
                      {detail.customerCode} — {detail.customerName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Warehouse</dt>
                    <dd className="font-semibold text-slate-800">
                      {detail.warehouseCode} — {detail.warehouseName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Created by</dt>
                    <dd className="font-semibold text-slate-800">
                      {detail.createdByName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Status</dt>
                    <dd>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(detail.status)}`}
                      >
                        {detail.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Ordered at</dt>
                    <dd className="font-semibold text-slate-800">
                      {formatDate(detail.orderedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Updated at</dt>
                    <dd className="font-semibold text-slate-800">
                      {formatDate(detail.updatedAt)}
                    </dd>
                  </div>
                </div>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-3">Product</th>
                        <th className="px-3 py-3">Quantity</th>
                        <th className="px-3 py-3">Unit price</th>
                        <th className="px-3 py-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items?.map((item) => (
                        <tr key={item.id} className="border-b border-slate-50">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-800">
                              {item.productName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.productSku}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {formatMoney(item.unitPrice)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-slate-700">
                            {formatMoney(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-4 text-right font-semibold text-slate-700"
                        >
                          Total
                        </td>
                        <td className="px-3 py-4 text-right text-lg font-bold text-slate-900">
                          {formatMoney(detail.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  {canEditDetail && (
                    <button
                      type="button"
                      onClick={() => {
                        setOperationError(null);
                        setFormMode("edit");
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil size={15} /> Edit Draft
                    </button>
                  )}
                  {isDetailDraft && canConfirm && (
                    <button
                      type="button"
                      disabled={workflowMutation.isPending}
                      onClick={() => workflowMutation.mutate("confirm")}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <Check size={15} />{" "}
                      {action === "confirm" ? "Confirming..." : "Confirm Order"}
                    </button>
                  )}
                  {canCancelDetail && (
                    <button
                      type="button"
                      disabled={workflowMutation.isPending}
                      onClick={() => workflowMutation.mutate("cancel")}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                    >
                      {action === "cancel" ? "Cancelling..." : "Cancel Order"}
                    </button>
                  )}
                </div>
                {operationError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
                  >
                    {operationError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {formMode && (
        <OrderFormDialog
          mode={formMode}
          order={formMode === "edit" ? detail : undefined}
          customers={customersQuery.data?.customers ?? []}
          warehouses={warehousesQuery.data?.warehouses ?? []}
          products={productsQuery.data?.products ?? []}
          isSubmitting={saveMutation.isPending}
          submitError={operationError}
          onClose={() => {
            if (!saveMutation.isPending) {
              setFormMode(null);
              setOperationError(null);
            }
          }}
          onSubmit={(payload) => saveMutation.mutate(payload)}
        />
      )}
    </div>
  );
}
