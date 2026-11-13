import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Package,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";

interface MetricCard {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconStyle: string;
}

const metrics: MetricCard[] = [
  {
    title: "Total Products",
    value: "—",
    description: "Awaiting API integration",
    icon: Package,
    iconStyle: "bg-blue-50 text-blue-600",
  },
  {
    title: "Warehouses",
    value: "—",
    description: "Awaiting API integration",
    icon: Warehouse,
    iconStyle: "bg-violet-50 text-violet-600",
  },
  {
    title: "Low Stock Items",
    value: "—",
    description: "Awaiting API integration",
    icon: AlertTriangle,
    iconStyle: "bg-amber-50 text-amber-600",
  },
  {
    title: "Open Orders",
    value: "—",
    description: "Awaiting API integration",
    icon: ShoppingCart,
    iconStyle: "bg-emerald-50 text-emerald-600",
  },
];

const quickLinks = [
  {
    title: "Manage Products",
    description: "View and manage your product catalog.",
    path: "/products",
    icon: Package,
  },
  {
    title: "View Inventory",
    description: "Monitor stock across warehouses.",
    path: "/inventory",
    icon: Boxes,
  },
  {
    title: "Manage Orders",
    description: "Review and process sales orders.",
    path: "/orders",
    icon: ShoppingCart,
  },
];

export default function DashboardPage() {
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

          <span className="inline-flex w-fit items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
            Dashboard preview
          </span>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {metric.title}
                </p>

                <div className={`rounded-xl p-2.5 ${metric.iconStyle}`}>
                  <Icon size={20} />
                </div>
              </div>

              <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
                {metric.value}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                {metric.description}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Inventory Overview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Stock summary across all warehouses.
              </p>
            </div>

            <Boxes size={21} className="text-slate-400" />
          </div>

          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <div className="rounded-2xl bg-slate-50 p-4 text-slate-400">
              <Boxes size={30} strokeWidth={1.5} />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-700">
              No inventory data connected yet
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Connect the inventory API to display stock levels and warehouse
              distribution.
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Orders</h2>

          <p className="mt-1 text-sm text-slate-500">
            Latest sales order activity.
          </p>

          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <div className="rounded-2xl bg-slate-50 p-4 text-slate-400">
              <ShoppingCart size={29} strokeWidth={1.5} />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-700">
              No order data connected yet
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Recent orders will appear here.
            </p>
          </div>
        </article>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900">Quick Access</h2>

          <p className="mt-1 text-sm text-slate-500">
            Navigate to frequently used modules.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {quickLinks.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="group flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                    <Icon size={20} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {item.title}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>

                <ArrowRight
                  size={17}
                  className="mt-1 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600"
                />
              </NavLink>
            );
          })}
        </div>
      </section>
    </div>
  );
}
