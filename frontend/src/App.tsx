import { BrowserRouter, Route, Routes } from "react-router";

import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import RoleGuard from "./components/auth/RoleGuard";

import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import ProductsPage from "./pages/ProductsPage";
import CategoriesPage from "./pages/CategoriesPage";
import CustomersPage from "./pages/CustomersPage";
import InventoryPage from "./pages/InventoryPage";
import StockMovementsPage from "./pages/StockMovementsPage";
import WarehousesPage from "./pages/WarehousesPage";
import OrdersPage from "./pages/OrdersPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />

            <Route path="products" element={<ProductsPage />} />

            <Route path="categories" element={<CategoriesPage />} />

            <Route path="warehouses" element={<WarehousesPage />} />

            <Route path="inventory" element={<InventoryPage />} />

            <Route
              path="stock-movements"
              element={
                <RoleGuard allowedRoles={["ADMIN", "WAREHOUSE_STAFF"]}>
                  <StockMovementsPage />
                </RoleGuard>
              }
            />

            <Route
              path="customers"
              element={
                <RoleGuard allowedRoles={["ADMIN", "SALES_STAFF"]}>
                  <CustomersPage />
                </RoleGuard>
              }
            />

            <Route path="orders" element={<OrdersPage />} />

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
