import { useState } from "react";
import { Outlet } from "react-router";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  function closeSidebar() {
    setIsSidebarOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      <Sidebar isOpen={isSidebarOpen} onNavigate={closeSidebar} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 px-5 py-7 sm:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-screen-2xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
