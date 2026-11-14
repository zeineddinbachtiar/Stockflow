import { LogOut, Menu, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { useAuth } from "../../context/useAuth";

interface TopbarProps {
  onMenuClick: () => void;
}

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/products": "Products",
  "/categories": "Categories",
  "/warehouses": "Warehouses",
  "/inventory": "Inventory",
  "/stock-movements": "Stock Movements",
  "/customers": "Customers",
  "/orders": "Orders",
};

export default function Topbar({ onMenuClick }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const currentTitle = pageTitles[location.pathname] ?? "StockFlow";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
        >
          <Menu size={22} />
        </button>

        <div>
          <p className="text-xs text-slate-400">Workspace / {currentTitle}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {currentTitle}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:inline-flex">
          Authenticated
        </span>

        <div className="hidden h-8 w-px bg-slate-200 sm:block" />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <UserRound size={20} />
          </div>

          <div className="hidden sm:block">
            <p className="max-w-36 truncate text-sm font-semibold text-slate-800">
              {user?.fullName}
            </p>
            <p className="text-xs text-slate-500">
              {user?.role.replaceAll("_", " ")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-lg p-2.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}
