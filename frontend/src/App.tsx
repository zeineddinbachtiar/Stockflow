import { BrowserRouter, Route, Routes } from "react-router";

import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import RoleGuard from "./components/auth/RoleGuard";

import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import ProductsPage from "./pages/ProductsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />

            <Route path="products" element={<ProductsPage />} />

            <Route
              path="categories"
              element={
                <PlaceholderPage
                  title="Categories"
                  description="Organize products into manageable categories."
                />
              }
            />

            <Route
              path="warehouses"
              element={
                <PlaceholderPage
                  title="Warehouses"
                  description="Manage warehouse locations and operational information."
                />
              }
            />

            <Route
              path="inventory"
              element={
                <PlaceholderPage
                  title="Inventory"
                  description="Monitor stock balances across your warehouses."
                />
              }
            />

            <Route
              path="stock-movements"
              element={
                <RoleGuard allowedRoles={["ADMIN", "WAREHOUSE_STAFF"]}>
                  <PlaceholderPage
                    title="Stock Movements"
                    description="Review receipts, issues, adjustments, and stock history."
                  />
                </RoleGuard>
              }
            />

            <Route
              path="customers"
              element={
                <RoleGuard allowedRoles={["ADMIN", "SALES_STAFF"]}>
                  <PlaceholderPage
                    title="Customers"
                    description="Manage customer profiles and contact information."
                  />
                </RoleGuard>
              }
            />

            <Route
              path="orders"
              element={
                <PlaceholderPage
                  title="Orders"
                  description="Create and manage sales orders and fulfillment workflows."
                />
              }
            />

            <Route
              path="*"
              element={
                <PlaceholderPage
                  title="Page not found"
                  description="The requested page does not exist."
                />
              }
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
