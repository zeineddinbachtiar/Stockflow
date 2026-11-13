import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../context/useAuth";

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
