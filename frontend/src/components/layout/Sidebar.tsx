import {
  Activity,
  ArrowLeftRight,
  Boxes,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tags,
  Users,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";

import { useAuth } from "../../context/useAuth";
import type { UserRole } from "../../types/auth.types";

interface SidebarProps {
  isOpen: boolean;
  onNavigate: () => void;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

const navigationGroups: NavigationGroup[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", path: "/", icon: LayoutDashboard }],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", path: "/products", icon: Package },
      { label: "Categories", path: "/categories", icon: Tags },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Warehouses", path: "/warehouses", icon: Warehouse },
      { label: "Inventory", path: "/inventory", icon: Boxes },
      {
        label: "Stock Movements",
        path: "/stock-movements",
        icon: ArrowLeftRight,
        roles: ["ADMIN", "WAREHOUSE_STAFF"],
      },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        label: "Customers",
        path: "/customers",
        icon: Users,
        roles: ["ADMIN", "SALES_STAFF"],
      },
      { label: "Orders", path: "/orders", icon: ShoppingCart },
    ],
  },
];

export default function Sidebar({ isOpen, onNavigate }: SidebarProps) {
  const { user } = useAuth();

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col",
        "border-r border-slate-200 bg-white",
        "transition-transform duration-200",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0",
      ].join(" ")}
    >
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-slate-100 px-6">
        <div className="rounded-xl bg-blue-600 p-2.5 text-white shadow-sm shadow-blue-200">
          <Boxes size={25} />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            StockFlow
          </h1>
          <p className="text-xs text-slate-500">Inventory Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
        {navigationGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || (user && item.roles.includes(user.role)),
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title}>
              <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {group.title}
              </p>

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        [
                          "flex items-center gap-3 rounded-xl px-3 py-2.5",
                          "text-sm transition-colors",
                          isActive
                            ? "bg-blue-50 font-semibold text-blue-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        ].join(" ")
                      }
                    >
                      <Icon size={19} strokeWidth={1.8} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" />
            <span className="text-xs font-medium text-slate-700">
              Authenticated Workspace
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {user?.role.replaceAll("_", " ")}
          </p>
        </div>
      </div>
    </aside>
  );
}
