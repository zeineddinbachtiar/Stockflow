import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Ban,
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  X,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import {
  createWarehouse,
  deactivateWarehouse,
  getWarehouses,
  updateWarehouse,
} from "../features/warehouses/warehouse.api";
import WarehouseFormDialog from "../features/warehouses/WarehouseFormDialog";
import type {
  Warehouse,
  WarehousePayload,
} from "../features/warehouses/warehouse.types";

const PAGE_SIZE = 10;

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function WarehousesPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "ADMIN";

  const [offset, setOffset] = useState(0);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(
    null,
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const warehouseQuery = useQuery({
    queryKey: ["warehouses", PAGE_SIZE, offset],
    queryFn: () => getWarehouses(accessToken!, PAGE_SIZE, offset),
    enabled: Boolean(accessToken),
    placeholderData: (previousData) => previousData,
  });

  const warehouses = warehouseQuery.data?.warehouses ?? [];
  const total = warehouseQuery.data?.total ?? 0;

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasPreviousPage = offset > 0;
  const hasNextPage = offset + PAGE_SIZE < total;

  const isInitialLoading = warehouseQuery.isPending;
  const isRequestError = warehouseQuery.isError && warehouses.length === 0;

  // CREATE AND EDIT WAREHOUSE
  const saveWarehouseMutation = useMutation({
    mutationFn: (payload: WarehousePayload) => {
      if (!accessToken) {
        throw new Error("Your session is unavailable. Please log in again.");
      }

      if (formMode === "edit" && editingWarehouse) {
        return updateWarehouse(accessToken, editingWarehouse.id, payload);
      }

      return createWarehouse(accessToken, payload);
    },

    onMutate: () => {
      setFormError(null);
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["warehouses"],
      });

      setFormMode(null);
      setEditingWarehouse(null);
      setFormError(null);
      setOffset(0);
    },

    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  // DEACTIVATE WAREHOUSE
  const deactivateMutation = useMutation({
    mutationFn: (warehouseId: string) => {
      if (!accessToken) {
        throw new Error("Your session is unavailable. Please log in again.");
      }

      return deactivateWarehouse(accessToken, warehouseId);
    },

    onMutate: () => {
      setDeactivateError(null);
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["warehouses"],
      });

      if (warehouses.length === 1 && offset > 0) {
        setOffset(Math.max(0, offset - PAGE_SIZE));
      }
    },

    onError: (error: Error) => {
      setDeactivateError(error.message);
    },
  });

  return (
    <div className="space-y-7">
      {/* PAGE HEADER */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">Operations</p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Warehouses
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage warehouse locations and operational information.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setEditingWarehouse(null);
                setFormMode("create");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus size={17} />
              Add Warehouse
            </button>
          )}

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <p className="text-xs text-slate-400">Total active warehouses</p>

            <p className="mt-1 text-lg font-bold text-slate-900">
              {isInitialLoading ? "—" : total.toLocaleString("id-ID")}
            </p>
          </div>
        </div>
      </section>

      {/* WAREHOUSE CATALOG */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
        <div>
          <h2 className="font-semibold text-slate-900">Warehouse Directory</h2>

          <p className="mt-1 text-sm text-slate-500">
            View and manage your active warehouse locations.
          </p>
        </div>

        {/* DEACTIVATION ERROR */}
        {deactivateError && (
          <div
            role="alert"
            className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <div>
              <p className="text-sm font-semibold text-red-800">
                Unable to deactivate warehouse
              </p>

              <p className="mt-1 text-sm text-red-700">{deactivateError}</p>
            </div>

            <button
              type="button"
              onClick={() => setDeactivateError(null)}
              aria-label="Dismiss error"
              className="text-red-500 hover:text-red-700"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* LOAD ERROR */}
        {isRequestError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle size={19} className="mt-0.5 text-red-600" />

            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                Unable to load warehouses
              </p>

              <p className="mt-1 text-sm text-red-700">
                {warehouseQuery.error instanceof Error
                  ? warehouseQuery.error.message
                  : "An unexpected error occurred."}
              </p>

              <button
                type="button"
                onClick={() => void warehouseQuery.refetch()}
                className="mt-2 text-sm font-semibold text-red-700 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!isRequestError && (
          <>
            {/* WAREHOUSE TABLE */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-3 font-semibold">Warehouse</th>
                    <th className="px-3 py-3 font-semibold">Address</th>
                    <th className="px-3 py-3 font-semibold">Created At</th>
                    <th className="px-3 py-3 font-semibold">Status</th>

                    {isAdmin && (
                      <th className="px-3 py-3 text-right font-semibold">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {/* LOADING */}
                  {isInitialLoading &&
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={isAdmin ? 5 : 4} className="px-3 py-3">
                          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                        </td>
                      </tr>
                    ))}

                  {/* DATA */}
                  {!isInitialLoading &&
                    warehouses.map((warehouse) => (
                      <tr
                        key={warehouse.id}
                        className="border-b border-slate-50 transition hover:bg-slate-50/70"
                      >
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                              <Building2 size={19} />
                            </div>

                            <div>
                              <p className="font-semibold text-slate-800">
                                {warehouse.name}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {warehouse.code}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="max-w-sm px-3 py-4 text-slate-600">
                          <div className="flex items-start gap-2">
                            <MapPin
                              size={15}
                              className="mt-0.5 shrink-0 text-slate-400"
                            />

                            <p className="line-clamp-2">
                              {warehouse.address || "No address provided."}
                            </p>
                          </div>
                        </td>

                        <td className="px-3 py-4 text-slate-500">
                          {formatDate(warehouse.createdAt)}
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              warehouse.isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {warehouse.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {isAdmin && (
                          <td className="px-3 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setFormError(null);
                                  setEditingWarehouse(warehouse);
                                  setFormMode("edit");
                                }}
                                aria-label={`Edit ${warehouse.name}`}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Pencil size={15} />
                                Edit
                              </button>

                              {warehouse.isActive && (
                                <button
                                  type="button"
                                  disabled={deactivateMutation.isPending}
                                  onClick={() => {
                                    const confirmed = window.confirm(
                                      `Deactivate warehouse "${warehouse.name}"? It will no longer be available for new inventory operations.`,
                                    );

                                    if (!confirmed) return;

                                    setDeactivateError(null);
                                    deactivateMutation.mutate(warehouse.id);
                                  }}
                                  aria-label={`Deactivate ${warehouse.name}`}
                                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Ban size={15} />

                                  {deactivateMutation.isPending &&
                                  deactivateMutation.variables === warehouse.id
                                    ? "Deactivating..."
                                    : "Deactivate"}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}

                  {/* EMPTY */}
                  {!isInitialLoading && warehouses.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="px-3 py-16">
                        <div className="flex flex-col items-center text-center">
                          <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
                            <Building2 size={28} />
                          </div>

                          <p className="mt-4 font-semibold text-slate-800">
                            No warehouses found
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {isAdmin
                              ? "Create your first warehouse to get started."
                              : "There are currently no active warehouses."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {!isInitialLoading && total > 0 && (
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
                  warehouses
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!hasPreviousPage}
                    onClick={() =>
                      setOffset((current) => Math.max(0, current - PAGE_SIZE))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <span className="px-2 text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={!hasNextPage}
                    onClick={() => setOffset((current) => current + PAGE_SIZE)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* CREATE / EDIT DIALOG */}
      {formMode && (
        <WarehouseFormDialog
          mode={formMode}
          warehouse={editingWarehouse ?? undefined}
          isSubmitting={saveWarehouseMutation.isPending}
          submitError={formError}
          onClose={() => {
            if (saveWarehouseMutation.isPending) return;

            setFormMode(null);
            setEditingWarehouse(null);
            setFormError(null);
          }}
          onSubmit={(payload) => saveWarehouseMutation.mutate(payload)}
        />
      )}
    </div>
  );
}
