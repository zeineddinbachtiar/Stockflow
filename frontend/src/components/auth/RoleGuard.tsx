import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { useAuth } from "../../context/useAuth";
import type { UserRole } from "../../types/auth.types";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: ReactNode;
}

export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
