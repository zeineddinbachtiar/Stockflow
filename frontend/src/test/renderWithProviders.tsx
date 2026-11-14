import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthContext } from "../context/auth-context";
import type { AuthContextValue } from "../context/auth-context";
import type { AuthUser, UserRole } from "../types/auth.types";

export const TEST_TOKEN = "stockflow-test-access-token";

export function renderWithProviders(
  ui: ReactElement,
  role: UserRole = "ADMIN",
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const user: AuthUser = {
    id: "test-user-001",
    fullName: "StockFlow Test User",
    email: "test@stockflow.local",
    role,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const authValue: AuthContextValue = {
    user,
    accessToken: TEST_TOKEN,
    isAuthenticated: true,
    login: async () => undefined,
    logout: () => undefined,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>
    </QueryClientProvider>,
  );
}
