import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import {
  getCategories,
  getProductById,
  getProducts,
} from "../features/products/product.api";
import type { Product } from "../features/products/product.types";

const PAGE_SIZE = 10;

function formatPrice(value: string): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function ProductDetailDialog({
  productId,
  accessToken,
  onClose,
  categories,
}: {
  productId: string;
  accessToken: string;
  onClose: () => void;
  categories: Map<string, string>;
}) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProductById(accessToken, productId),
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        className="w-full max-w-xl rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2
              id="product-detail-title"
              className="text-lg font-bold text-slate-900"
            >
              Product Details
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Product information and catalog details.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close product details"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {isLoading && (
            <div className="space-y-4">
              <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                Unable to load product details.
              </p>
              <p className="mt-1 text-sm text-red-700">
                {error instanceof Error ? error.message : "Unknown error."}
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-3 text-sm font-semibold text-red-700 underline"
              >
                Try again
              </button>
            </div>
          )}

          {data && (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-blue-50 p-4 text-blue-600">
                  <Package size={28} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-slate-900">
                    {data.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">SKU: {data.sku}</p>
                  <span
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      data.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {data.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-400">Category</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {categories.get(data.categoryId) ?? "Unknown category"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Unit Price</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {formatPrice(data.unitPrice)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Created At</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {formatDate(data.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Last Updated</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {formatDate(data.updatedAt)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400">
                  Description
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {data.description || "No description provided."}
                </p>
              </div>

              <p className="break-all text-xs text-slate-400">
                Product ID: {data.id}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export default function ProductsPage() {
  const { accessToken } = useAuth();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );

  // Wait briefly after typing before requesting the server.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const productQuery = useQuery({
    queryKey: ["products", search, offset],
    queryFn: () =>
      getProducts(accessToken!, {
        search,
        limit: PAGE_SIZE,
        offset,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previousData) => previousData,
  });

  const categoryQuery = useQuery({
    queryKey: ["categories", "product-form"],
    queryFn: () => getCategories(accessToken!),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  const categories = new Map(
    (categoryQuery.data ?? []).map((category) => [category.id, category.name]),
  );

  const products = productQuery.data?.products ?? [];
  const total = productQuery.data?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasPreviousPage = offset > 0;
  const hasNextPage = offset + PAGE_SIZE < total;

  const isInitialLoading = productQuery.isPending;
  const isRequestError = productQuery.isError && products.length === 0;

  function openProduct(product: Product) {
    setSelectedProductId(product.id);
  }

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">Catalog</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Products
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage and monitor your product catalog.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <p className="text-xs text-slate-400">Total active products</p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {isInitialLoading ? "—" : total.toLocaleString("id-ID")}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-900">Product Catalog</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search products by name or SKU.
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
              aria-label="Search products by name or SKU"
              maxLength={100}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            />
          </div>
        </div>

        {isRequestError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle size={19} className="mt-0.5 text-red-600" />

            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                Unable to load products
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

        {!isRequestError && (
          <>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-3 font-semibold">Product</th>
                    <th className="px-3 py-3 font-semibold">Category</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Unit Price
                    </th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isInitialLoading &&
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={5} className="px-3 py-3">
                          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                        </td>
                      </tr>
                    ))}

                  {!isInitialLoading &&
                    products.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-slate-50 transition hover:bg-slate-50/70"
                      >
                        <td className="px-3 py-4">
                          <p className="font-semibold text-slate-800">
                            {product.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            SKU: {product.sku}
                          </p>
                        </td>

                        <td className="px-3 py-4 text-slate-600">
                          {categories.get(product.categoryId) ??
                            (categoryQuery.isError
                              ? "Unavailable"
                              : "Loading...")}
                        </td>

                        <td className="px-3 py-4 text-right font-medium tabular-nums text-slate-800">
                          {formatPrice(product.unitPrice)}
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              product.isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {product.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-3 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openProduct(product)}
                            aria-label={`View ${product.name} details`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Eye size={15} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}

                  {!isInitialLoading && products.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                          <div className="rounded-2xl bg-slate-50 p-4 text-slate-400">
                            <Package size={30} strokeWidth={1.5} />
                          </div>

                          <h3 className="mt-4 text-sm font-semibold text-slate-700">
                            {search
                              ? "No matching products"
                              : "No products found"}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {search
                              ? "Try another product name or SKU."
                              : "Your product catalog is currently empty."}
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

        {productQuery.isFetching && !isInitialLoading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <RefreshCw size={13} className="animate-spin" />
            Updating product list...
          </div>
        )}
      </section>

      {selectedProductId && accessToken && (
        <ProductDetailDialog
          productId={selectedProductId}
          accessToken={accessToken}
          categories={categories}
          onClose={() => setSelectedProductId(null)}
        />
      )}
    </div>
  );
}
