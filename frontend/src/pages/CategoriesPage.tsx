import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Ban,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Tags,
  X,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import {
  createCategory,
  deactivateCategory,
  getCategories,
  updateCategory,
} from "../features/categories/category.api";
import CategoryFormDialog from "../features/categories/CategoryFormDialog";
import type {
  Category,
  CategoryPayload,
} from "../features/categories/category.types";

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

export default function CategoriesPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "ADMIN";

  const [offset, setOffset] = useState(0);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [categoryToDeactivate, setCategoryToDeactivate] =
    useState<Category | null>(null);

  const categoryQuery = useQuery({
    queryKey: ["categories", PAGE_SIZE, offset],
    queryFn: () => getCategories(accessToken!, PAGE_SIZE, offset),
    enabled: Boolean(accessToken),
    placeholderData: (previousData) => previousData,
  });

  const categories = categoryQuery.data?.categories ?? [];
  const total = categoryQuery.data?.total ?? 0;

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasPreviousPage = offset > 0;
  const hasNextPage = offset + PAGE_SIZE < total;

  const isInitialLoading = categoryQuery.isPending;

  const isRequestError = categoryQuery.isError && categories.length === 0;

  // CREATE AND EDIT CATEGORY
  const saveCategoryMutation = useMutation({
    mutationFn: (payload: CategoryPayload) => {
      if (!accessToken) {
        throw new Error("Your session is unavailable. Please log in again.");
      }

      if (formMode === "edit" && editingCategory) {
        return updateCategory(accessToken, editingCategory.id, payload);
      }

      return createCategory(accessToken, payload);
    },

    onMutate: () => {
      setFormError(null);
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["categories"],
      });

      setFormMode(null);
      setEditingCategory(null);
      setFormError(null);
      setOffset(0);
    },

    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  // DEACTIVATE CATEGORY
  const deactivateMutation = useMutation({
    mutationFn: (categoryId: string) => {
      if (!accessToken) {
        throw new Error("Your session is unavailable. Please log in again.");
      }

      return deactivateCategory(accessToken, categoryId);
    },

    onMutate: () => {
      setDeactivateError(null);
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["categories"],
      });

      // Move to the previous page if the current page becomes empty.
      if (categories.length === 1 && offset > 0) {
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
          <p className="text-sm font-medium text-blue-600">Catalog</p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Categories
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Organize products into manageable categories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setEditingCategory(null);
                setFormMode("create");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus size={17} />
              Add Category
            </button>
          )}

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <p className="text-xs text-slate-400">Total active categories</p>

            <p className="mt-1 text-lg font-bold text-slate-900">
              {isInitialLoading ? "—" : total.toLocaleString("id-ID")}
            </p>
          </div>
        </div>
      </section>

      {/* CATEGORY CATALOG */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
        <div>
          <h2 className="font-semibold text-slate-900">Category Catalog</h2>

          <p className="mt-1 text-sm text-slate-500">
            View and manage your product categories.
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
                Unable to deactivate category
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
                Unable to load categories
              </p>

              <p className="mt-1 text-sm text-red-700">
                {categoryQuery.error instanceof Error
                  ? categoryQuery.error.message
                  : "An unexpected error occurred."}
              </p>

              <button
                type="button"
                onClick={() => void categoryQuery.refetch()}
                className="mt-2 text-sm font-semibold text-red-700 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!isRequestError && (
          <>
            {/* CATEGORY TABLE */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-3 font-semibold">Category</th>

                    <th className="px-3 py-3 font-semibold">Description</th>

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
                    categories.map((category) => (
                      <tr
                        key={category.id}
                        className="border-b border-slate-50 transition hover:bg-slate-50/70"
                      >
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                              <Tags size={19} />
                            </div>

                            <p className="font-semibold text-slate-800">
                              {category.name}
                            </p>
                          </div>
                        </td>

                        <td className="max-w-md px-3 py-4 text-slate-600">
                          <p className="line-clamp-2">
                            {category.description || "No description provided."}
                          </p>
                        </td>

                        <td className="px-3 py-4 text-slate-500">
                          {formatDate(category.createdAt)}
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              category.isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {category.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {isAdmin && (
                          <td className="px-3 py-4">
                            <div className="flex justify-end gap-2">
                              {/* EDIT */}
                              <button
                                type="button"
                                onClick={() => {
                                  setFormError(null);
                                  setEditingCategory(category);
                                  setFormMode("edit");
                                }}
                                aria-label={`Edit ${category.name}`}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Pencil size={15} />
                                Edit
                              </button>

                              {/* DEACTIVATE */}
                              {category.isActive && (
                                <button
                                  type="button"
                                  disabled={deactivateMutation.isPending}
                                  onClick={() =>
                                    setCategoryToDeactivate(category)
                                  }
                                  aria-label={`Deactivate ${category.name}`}
                                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Ban size={15} />

                                  {deactivateMutation.isPending &&
                                  deactivateMutation.variables === category.id
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
                  {!isInitialLoading && categories.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4}>
                        <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                          <div className="rounded-2xl bg-slate-50 p-4 text-slate-400">
                            <Tags size={30} strokeWidth={1.5} />
                          </div>

                          <h3 className="mt-4 text-sm font-semibold text-slate-700">
                            No categories found
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            Your category catalog is currently empty.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="mt-5 flex flex-col justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <p className="text-xs text-slate-500">
                {total === 0
                  ? "No categories to display"
                  : `Showing ${offset + 1}–${Math.min(
                      offset + categories.length,
                      total,
                    )} of ${total} categories`}
              </p>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={!hasPreviousPage || categoryQuery.isFetching}
                  onClick={() =>
                    setOffset((current) => Math.max(0, current - PAGE_SIZE))
                  }
                  aria-label="Previous page"
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  type="button"
                  disabled={!hasNextPage || categoryQuery.isFetching}
                  onClick={() => setOffset((current) => current + PAGE_SIZE)}
                  aria-label="Next page"
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}

        {categoryQuery.isFetching && !isInitialLoading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <RefreshCw size={13} className="animate-spin" />
            Updating category list...
          </div>
        )}
      </section>

      {/* CREATE / EDIT DIALOG */}
      {formMode && accessToken && (
        <CategoryFormDialog
          mode={formMode}
          category={editingCategory ?? undefined}
          isSubmitting={saveCategoryMutation.isPending}
          submitError={formError}
          onClose={() => {
            if (saveCategoryMutation.isPending) return;

            setFormMode(null);
            setEditingCategory(null);
            setFormError(null);
          }}
          onSubmit={(payload) => saveCategoryMutation.mutate(payload)}
        />
      )}

      {categoryToDeactivate && (
        <ConfirmDialog
          title={`Deactivate ${categoryToDeactivate.name}?`}
          description="This category will no longer be available for new product assignments."
          confirmLabel="Deactivate category"
          tone="danger"
          isConfirming={deactivateMutation.isPending}
          onCancel={() => setCategoryToDeactivate(null)}
          onConfirm={() => {
            setDeactivateError(null);
            deactivateMutation.mutate(categoryToDeactivate.id, {
              onSettled: () => setCategoryToDeactivate(null),
            });
          }}
        />
      )}
    </div>
  );
}
