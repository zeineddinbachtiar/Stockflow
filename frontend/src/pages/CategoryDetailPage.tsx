import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Package,
  RefreshCw,
  Search,
  Tags,
} from "lucide-react";
import { Link, useParams } from "react-router";

import { useAuth } from "../context/useAuth";
import { ApiError } from "../lib/api";
import { getCategoryById } from "../features/categories/category.api";
import { getProducts } from "../features/products/product.api";

const PAGE_SIZE = 10;

function formatPrice(value: string): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function CategoryDetailPage() {
  const { accessToken } = useAuth();
  const { id } = useParams();
  const categoryId = id ?? "";

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const categoryQuery = useQuery({
    queryKey: ["categories", categoryId],
    queryFn: () => getCategoryById(accessToken!, categoryId),
    enabled: Boolean(accessToken && categoryId),
  });

  const productQuery = useQuery({
    queryKey: ["products", "category", categoryId, search, offset],
    queryFn: () =>
      getProducts(accessToken!, {
        categoryId,
        status: "active",
        search,
        limit: PAGE_SIZE,
        offset,
      }),
    enabled: Boolean(accessToken && categoryId && categoryQuery.isSuccess),
  });

  const products = productQuery.data?.products ?? [];
  const total = productQuery.data?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPreviousPage = offset > 0;
  const hasNextPage = offset + PAGE_SIZE < total;
  const categoryNotFound =
    categoryQuery.error instanceof ApiError &&
    categoryQuery.error.status === 404;

  return (
    <div className="space-y-7">
      <section>
        <Link
          to="/categories"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          <ArrowLeft size={17} />
          Back to categories
        </Link>
        <p className="mt-5 text-sm font-medium text-blue-600">Catalog</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Category details
        </h1>
      </section>

      {!categoryId && (
        <div
          role="alert"
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          Category not found.
        </div>
      )}

      {categoryId && categoryQuery.isPending && (
        <section
          aria-label="Loading category"
          className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="h-6 w-48 rounded bg-slate-100" />
          <div className="mt-3 h-4 w-72 max-w-full rounded bg-slate-100" />
        </section>
      )}

      {categoryId && categoryQuery.isError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <AlertCircle size={19} className="mt-0.5 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {categoryNotFound
                ? "Category not found"
                : "Unable to load category"}
            </p>
            <p className="mt-1 text-sm text-red-700">
              {categoryNotFound
                ? "This category does not exist or is inactive."
                : categoryQuery.error instanceof Error
                  ? categoryQuery.error.message
                  : "An unexpected error occurred."}
            </p>
            {!categoryNotFound && (
              <button
                type="button"
                onClick={() => void categoryQuery.refetch()}
                className="mt-2 text-sm font-semibold text-red-700 underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {categoryQuery.data && (
        <>
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100 sm:flex-row sm:items-start">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Tags size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">
                  {categoryQuery.data.name}
                </h2>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    categoryQuery.data.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {categoryQuery.data.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {categoryQuery.data.description || "No description provided."}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold text-slate-900">Products</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Products assigned to this category.
                </p>
              </div>
              <div className="relative w-full sm:max-w-sm">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search product or SKU..."
                  aria-label="Search products in category"
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>

            {productQuery.isError && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <AlertCircle size={19} className="mt-0.5 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Unable to load category products
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    {productQuery.error instanceof Error
                      ? productQuery.error.message
                      : "An unexpected error occurred."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void productQuery.refetch()}
                    className="mt-2 text-sm font-semibold text-red-700 underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {!productQuery.isError && (
              <>
                <div className="relative mt-6 max-w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
                  <table className="responsive-data-table w-full min-w-[620px] text-left text-sm">
                    <caption className="sr-only">
                      Products in {categoryQuery.data.name}
                    </caption>
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-3 font-semibold">Product</th>
                        <th className="px-3 py-3 font-semibold">Category</th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Unit Price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {productQuery.isPending &&
                        Array.from({ length: 5 }).map((_, index) => (
                          <tr key={index}>
                            <td colSpan={3} className="px-3 py-3">
                              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                            </td>
                          </tr>
                        ))}

                      {!productQuery.isPending &&
                        products.map((product) => (
                          <tr
                            key={product.id}
                            className="border-b border-slate-50"
                          >
                            <td data-label="Product" className="px-3 py-4">
                              <p className="font-semibold text-slate-800">
                                {product.name}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                SKU: {product.sku}
                              </p>
                            </td>
                            <td
                              data-label="Category"
                              className="px-3 py-4 text-slate-600"
                            >
                              {categoryQuery.data.name}
                            </td>
                            <td
                              data-label="Unit price"
                              className="px-3 py-4 text-right font-medium tabular-nums text-slate-800"
                            >
                              {formatPrice(product.unitPrice)}
                            </td>
                          </tr>
                        ))}

                      {!productQuery.isPending && products.length === 0 && (
                        <tr>
                          <td colSpan={3}>
                            <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                              <div className="rounded-2xl bg-slate-50 p-4 text-slate-400">
                                <Package size={30} strokeWidth={1.5} />
                              </div>
                              <h3 className="mt-4 text-sm font-semibold text-slate-700">
                                {search
                                  ? "No matching products"
                                  : "No products in this category"}
                              </h3>
                              <p className="mt-1 text-sm text-slate-500">
                                {search
                                  ? "Try another product name or SKU."
                                  : "No active products are assigned to this category."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 flex flex-col justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                  <p className="text-xs text-slate-500">
                    {total === 0
                      ? "No products to display"
                      : `Showing ${offset + 1}–${Math.min(
                          offset + products.length,
                          total,
                        )} of ${total} products`}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={!hasPreviousPage || productQuery.isFetching}
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
                      disabled={!hasNextPage || productQuery.isFetching}
                      onClick={() =>
                        setOffset((current) => current + PAGE_SIZE)
                      }
                      aria-label="Next page"
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {productQuery.isFetching && !productQuery.isPending && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw size={13} className="animate-spin" />
                Updating products...
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
