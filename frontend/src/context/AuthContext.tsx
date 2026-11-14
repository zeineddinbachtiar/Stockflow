import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { apiRequest } from "../lib/api";
import { AuthContext } from "./auth-context";

import type {
  ApiEnvelope,
  AuthResult,
  AuthSession,
  AuthUser,
  UserRole,
} from "../types/auth.types";

import type { AuthContextValue, LoginCredentials } from "./auth-context";

const SESSION_KEY = "stockflow.auth.session";

function isValidRole(value: unknown): value is UserRole {
  return (
    value === "ADMIN" || value === "WAREHOUSE_STAFF" || value === "SALES_STAFF"
  );
}

function isValidUser(value: unknown): value is AuthUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const user = value as Record<string, unknown>;

  return (
    typeof user.id === "string" &&
    typeof user.fullName === "string" &&
    typeof user.email === "string" &&
    isValidRole(user.role) &&
    user.isActive === true &&
    typeof user.createdAt === "string"
  );
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);

    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    const candidate = parsed as Partial<AuthSession>;

    if (
      typeof candidate.accessToken !== "string" ||
      !candidate.accessToken ||
      !isValidUser(candidate.user)
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return {
      accessToken: candidate.accessToken,
      user: candidate.user,
    };
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(readStoredSession);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await apiRequest<ApiEnvelope<AuthResult>>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    const result = response.data;

    if (
      !result.accessToken ||
      result.tokenType !== "Bearer" ||
      !Number.isFinite(result.expiresIn) ||
      result.expiresIn <= 0 ||
      !isValidUser(result.user)
    ) {
      throw new Error("The API returned an invalid authentication response.");
    }

    const nextSession: AuthSession = {
      accessToken: result.accessToken,
      user: result.user,
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      isAuthenticated: Boolean(session),
      login,
      logout,
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
