import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Package,
  RefreshCw,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";

import { useAuth } from "../context/useAuth";
import {
  getDashboardData,
  type DashboardOrderStatus,
} from "../features/dashboard/dashboard.api";

interface MetricCardProps {
  title: string;
  value: number | undefined;
  description: string;
  icon: LucideIcon;
  iconStyle: string;
  isLoading: boolean;
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  iconStyle,
  isLoading,
}: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>

        <div className={`rounded-xl p-2.5 ${iconStyle}`}>
          <Icon size={20} />
        </div>
      </div>

      <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
        {isLoading ? (
          <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          (value ?? 0).toLocaleString("id-ID")
        )}
      </p>

      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </article>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatAmount(value: string): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getOrderStatusStyle(status: DashboardOrderStatus): string {
  switch (status) {
    case "DRAFT":
      return "bg-amber-50 text-amber-700";
    case "CONFIRMED":
      return "bg-emerald-50 text-emerald-700";
    case "CANCELLED":
      return "bg-slate-100 text-slate-600";
  }
}

export default function DashboardPage() {
  const { accessToken, user } = useAuth();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => getDashboardData(accessToken!),
    enabled: Boolean(accessToken),
    staleTime: 30_000,
  });

  const metrics = [
    {
      title: "Active Products",
      value: data?.totalProducts,
      description: "Products available in catalog",
      icon: Package,
      iconStyle: "bg-blue-50 text-blue-600",
    },
    {
      title: "Active Warehouses",
      value: data?.totalWarehouses,
      description: "Registered active warehouses",
      icon: Warehouse,
      iconStyle: "bg-violet-50 text-violet-600",
    },
    {
      title: "Low Stock Records",
      value: data?.lowStockTotal,
      description: "Product and warehouse combinations",
      icon: AlertTriangle,
      iconStyle: "bg-amber-50 text-amber-600",
    },
    {
      title: "Draft Orders",
      value: data?.draftOrderTotal,
      description: "Orders awaiting confirmation",
      icon: ShoppingCart,
      iconStyle: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-blue-600">Overview</p>

        <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              Monitor your inventory and order operations from one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      {isError && (
        <section
          role="alert"
          className="flex flex-col justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center"
        >
          <div>
            <h2 className="text-sm font-semibold text-red-800">
              Unable to load dashboard data
            </h2>
            <p className="mt-1 text-sm text-red-700">
              {error instanceof Error
                ? error.message
                : "Please check the API connection and try again."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refetch()}
            className="w-fit rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </section>
      )}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} isLoading={isLoading} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Low Stock Watchlist
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Products that have reached their reorder levels.
              </p>
            </div>

            <Boxes size={21} className="text-slate-400" />
          </div>

          {isLoading ? (
            <div className="mt-6 space-y-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : data?.lowStockItems.length ? (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400">
                    <th className="pb-3 font-medium">Product</th>
                    <th className="pb-3 font-medium">Warehouse</th>
                    <th className="pb-3 text-right font-medium">On Hand</th>
                    <th className="pb-3 text-right font-medium">Reorder</th>
                  </tr>
                </thead>

                <tbody>
                  {data.lowStockItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-4 pr-3">
                        <p className="font-medium text-slate-800">
                          {item.productName}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.productSku}
                        </p>
                      </td>

                      <td className="py-4 pr-3 text-slate-600">
                        {item.warehouseName}
                      </td>

                      <td className="py-4 text-right font-semibold text-amber-700">
                        {item.quantityOnHand}
                      </td>

                      <td className="py-4 text-right text-slate-500">
                        {item.reorderLevel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {data.lowStockTotal > data.lowStockItems.length && (
                <p className="mt-3 text-xs text-slate-400">
                  Showing {data.lowStockItems.length} of {data.lowStockTotal}{" "}
                  low-stock records.
                </p>
              )}
            </div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-600">
                <Boxes size={30} strokeWidth={1.5} />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-700">
                No low-stock records
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                All inventory records are above their reorder levels.
              </p>
            </div>
          )}

          <NavLink
            to="/inventory"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View inventory
            <ArrowRight size={16} />
          </NavLink>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Orders</h2>

          <p className="mt-1 text-sm text-slate-500">
            Latest sales order activity.
          </p>

          {isLoading ? (
            <div className="mt-6 space-y-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : data?.recentOrders.length ? (
            <div className="mt-5 space-y-4">
              {data.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {order.customerName}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${getOrderStatusStyle(order.status)}`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between gap-2 text-xs text-slate-400">
                    <span>{formatDate(order.orderedAt)}</span>
                    <span className="font-medium text-slate-600">
                      {formatAmount(order.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <ShoppingCart
                size={30}
                strokeWidth={1.5}
                className="text-slate-300"
              />
              <h3 className="mt-4 text-sm font-semibold text-slate-700">
                No orders yet
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                New orders will appear here.
              </p>
            </div>
          )}

          <NavLink
            to="/orders"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View orders
            <ArrowRight size={16} />
          </NavLink>
        </article>
      </section>
    </div>
  );
}
