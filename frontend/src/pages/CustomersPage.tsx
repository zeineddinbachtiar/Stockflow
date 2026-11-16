import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import CustomerFormDialog from "../features/customers/CustomerFormDialog";
import {
  createCustomer,
  getCustomerById,
  getCustomers,
  updateCustomer,
} from "../features/customers/customer.api";
import type {
  Customer,
  CustomerPayload,
} from "../features/customers/customer.types";

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

export default function CustomersPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const canMutate = user?.role === "ADMIN" || user?.role === "SALES_STAFF";
  const [offset, setOffset] = useState(0);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", PAGE_SIZE, offset],
    queryFn: () => getCustomers(accessToken!, PAGE_SIZE, offset),
    enabled: Boolean(accessToken),
    placeholderData: (previousData) => previousData,
  });

  const detailQuery = useQuery({
    queryKey: ["customer-detail", selectedCustomer?.id],
    queryFn: () => getCustomerById(accessToken!, selectedCustomer!.id),
    enabled: Boolean(accessToken && selectedCustomer),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: CustomerPayload) => {
      if (!accessToken) {
        throw new Error("Your session is unavailable. Please log in again.");
      }

      if (formMode === "edit" && editingCustomer) {
        return updateCustomer(accessToken, editingCustomer.id, payload);
      }

      return createCustomer(accessToken, payload);
    },
    onMutate: () => {
      setFormError(null);
      setSuccessMessage(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-detail"] });
      setFormMode(null);
      setEditingCustomer(null);
      setFormError(null);
      setOffset(0);
      setSuccessMessage("Customer saved successfully.");
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const customers = customersQuery.data?.customers ?? [];
  const total = customersQuery.data?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isInitialLoading = customersQuery.isPending;
  const isRequestError = customersQuery.isError && customers.length === 0;

  function openCreate() {
    setFormError(null);
    setEditingCustomer(null);
    setFormMode("create");
  }

  function openEdit(customer: Customer) {
    setFormError(null);
    setEditingCustomer(customer);
    setFormMode("edit");
  }

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">Sales</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Customers
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage customer profiles and contact information.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canMutate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={17} /> Add Customer
            </button>
          )}
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <p className="text-xs text-slate-400">Total customers</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {isInitialLoading ? "—" : total.toLocaleString("id-ID")}
            </p>
          </div>
        </div>
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
        <div>
          <h2 className="font-semibold text-slate-900">Customer Directory</h2>
          <p className="mt-1 text-sm text-slate-500">
            View customer records and maintain contact information.
          </p>
        </div>

        {isRequestError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle size={19} className="mt-0.5 text-red-600" />
            <div className="flex-1">
              <p className="font-semibold text-red-800">
                Unable to load customers
              </p>
              <p className="mt-1 text-sm text-red-700">
                {customersQuery.error instanceof Error
                  ? customersQuery.error.message
                  : "An unexpected error occurred."}
              </p>
              <button
                type="button"
                onClick={() => void customersQuery.refetch()}
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
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold">Email</th>
                    <th className="px-3 py-3 font-semibold">Phone</th>
                    <th className="px-3 py-3 font-semibold">Address</th>
                    <th className="px-3 py-3 font-semibold">Created At</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isInitialLoading &&
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={6} className="px-3 py-3">
                          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                        </td>
                      </tr>
                    ))}
                  {!isInitialLoading &&
                    customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-slate-50 hover:bg-slate-50/70"
                      >
                        <td className="px-3 py-4">
                          <p className="font-semibold text-slate-800">
                            {customer.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {customer.customerCode}
                          </p>
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {customer.email || "—"}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {customer.phone || "—"}
                        </td>
                        <td className="max-w-xs px-3 py-4 text-slate-600">
                          <p className="line-clamp-2">
                            {customer.address || "—"}
                          </p>
                        </td>
                        <td className="px-3 py-4 text-slate-500">
                          {formatDate(customer.createdAt)}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(customer)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              <Eye size={14} /> View
                            </button>
                            {canMutate && (
                              <button
                                type="button"
                                onClick={() => openEdit(customer)}
                                aria-label={`Edit ${customer.name}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Pencil size={14} /> Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!isInitialLoading && customers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-16">
                        <div className="flex flex-col items-center text-center">
                          <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
                            <Users size={28} />
                          </div>
                          <p className="mt-4 font-semibold text-slate-800">
                            No customers found
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Create your first customer record to get started.
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
                  {total === 0 ? (
                    "No customers to display"
                  ) : (
                    <>
                      Showing{" "}
                      <span className="font-semibold text-slate-700">
                        {offset + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-semibold text-slate-700">
                        {Math.min(offset + customers.length, total)}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-slate-700">
                        {total}
                      </span>{" "}
                      customers
                    </>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-2 text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={offset === 0 || customersQuery.isFetching}
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
                      offset + PAGE_SIZE >= total || customersQuery.isFetching
                    }
                    onClick={() => setOffset((current) => current + PAGE_SIZE)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
            {customersQuery.isFetching && !isInitialLoading && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw size={13} className="animate-spin" /> Updating
                customer list...
              </div>
            )}
          </>
        )}
      </section>

      {selectedCustomer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-labelledby="customer-detail-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="customer-detail-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Customer Detail
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedCustomer.customerCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                aria-label="Close detail"
              >
                <X size={18} />
              </button>
            </div>
            {detailQuery.isPending && (
              <div className="mt-6 h-28 animate-pulse rounded-lg bg-slate-100" />
            )}
            {detailQuery.isError && (
              <div
                role="alert"
                className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                <p>Unable to load customer detail.</p>
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
                  <dt className="text-slate-500">Name</dt>
                  <dd className="font-semibold text-slate-800">
                    {detailQuery.data.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Code</dt>
                  <dd className="font-semibold text-slate-800">
                    {detailQuery.data.customerCode}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-semibold text-slate-800">
                    {detailQuery.data.email || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-semibold text-slate-800">
                    {detailQuery.data.phone || "—"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500">Address</dt>
                  <dd className="font-semibold text-slate-800">
                    {detailQuery.data.address || "—"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500">Created At</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatDate(detailQuery.data.createdAt)}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      )}

      {formMode && (
        <CustomerFormDialog
          mode={formMode}
          customer={editingCustomer ?? undefined}
          isSubmitting={saveMutation.isPending}
          submitError={formError}
          onClose={() => {
            if (!saveMutation.isPending) {
              setFormMode(null);
              setEditingCustomer(null);
              setFormError(null);
            }
          }}
          onSubmit={(payload) => saveMutation.mutate(payload)}
        />
      )}
    </div>
  );
}
