import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { ApiError, apiRequest, registerAuthSessionHandlers } from "../lib/api";
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
const REFRESH_LEAD_TIME_MS = 60_000;
const NETWORK_RETRY_DELAY_MS = 60_000;

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
    user.id.length > 0 &&
    typeof user.fullName === "string" &&
    typeof user.email === "string" &&
    isValidRole(user.role) &&
    user.isActive === true &&
    typeof user.createdAt === "string"
  );
}

function isValidSession(value: unknown): value is AuthSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const session = value as Partial<AuthSession>;

  return (
    typeof session.accessToken === "string" &&
    session.accessToken.length > 0 &&
    typeof session.refreshToken === "string" &&
    session.refreshToken.length > 0 &&
    typeof session.expiresAt === "number" &&
    Number.isFinite(session.expiresAt) &&
    isValidUser(session.user)
  );
}

function hasValidAccessToken(session: AuthSession): boolean {
  return session.expiresAt > Date.now();
}

function clearStoredSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!isValidSession(parsed)) {
      clearStoredSession();
      return null;
    }

    return parsed;
  } catch {
    clearStoredSession();
    return null;
  }
}

function isValidAuthResult(result: AuthResult): boolean {
  return (
    typeof result.accessToken === "string" &&
    result.accessToken.length > 0 &&
    typeof result.refreshToken === "string" &&
    result.refreshToken.length > 0 &&
    result.tokenType === "Bearer" &&
    Number.isFinite(result.expiresIn) &&
    result.expiresIn > 0 &&
    isValidUser(result.user)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [storedSession] = useState(readStoredSession);
  const [session, setSession] = useState<AuthSession | null>(() =>
    storedSession && hasValidAccessToken(storedSession) ? storedSession : null,
  );
  const sessionRef = useRef<AuthSession | null>(session ?? storedSession);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryPromiseRef = useRef<Promise<void> | null>(null);
  const [isInitializing, setIsInitializing] = useState(
    Boolean(storedSession && !hasValidAccessToken(storedSession)),
  );
  const [sessionRecoveryError, setSessionRecoveryError] = useState<
    string | null
  >(null);

  const updateSession = useCallback((nextSession: AuthSession | null) => {
    sessionRef.current = nextSession;

    if (nextSession) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    } else {
      clearStoredSession();
    }

    setSession(nextSession);
  }, []);

  const clearSession = useCallback(() => {
    updateSession(null);
  }, [updateSession]);

  const refreshAccessToken = useCallback(
    async (rejectedAccessToken: string): Promise<string> => {
      const currentSession = sessionRef.current;

      if (!currentSession) {
        throw new ApiError(
          "Authentication session is unavailable.",
          401,
          "INVALID_REFRESH_TOKEN",
        );
      }

      if (currentSession.accessToken !== rejectedAccessToken) {
        return currentSession.accessToken;
      }

      const response = await apiRequest<ApiEnvelope<AuthResult>>(
        "/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({
            refreshToken: currentSession.refreshToken,
          }),
        },
      );

      const result = response.data;

      if (!isValidAuthResult(result)) {
        throw new Error("The API returned an invalid refresh response.");
      }

      const latestSession = sessionRef.current;

      if (!latestSession || latestSession.accessToken !== rejectedAccessToken) {
        if (latestSession) {
          return latestSession.accessToken;
        }

        throw new ApiError(
          "Authentication session is unavailable.",
          401,
          "INVALID_REFRESH_TOKEN",
        );
      }

      const nextSession: AuthSession = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: Date.now() + result.expiresIn * 1000,
        user: result.user,
      };

      updateSession(nextSession);

      return nextSession.accessToken;
    },
    [updateSession],
  );

  const onSessionExpired = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const recoverStoredSession = useCallback((): Promise<void> => {
    if (recoveryPromiseRef.current) {
      return recoveryPromiseRef.current;
    }

    const recoveryPromise = (async () => {
      const currentSession = sessionRef.current;

      if (!currentSession) {
        setIsInitializing(false);
        return;
      }

      setSessionRecoveryError(null);

      if (hasValidAccessToken(currentSession)) {
        updateSession(currentSession);
        setIsInitializing(false);
        return;
      }

      try {
        await refreshAccessToken(currentSession.accessToken);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
        } else {
          setSessionRecoveryError(
            error instanceof Error
              ? error.message
              : "Unable to restore your session. Please retry.",
          );
        }
      } finally {
        setIsInitializing(false);
      }
    })();

    recoveryPromiseRef.current = recoveryPromise;

    void recoveryPromise.then(
      () => {
        if (recoveryPromiseRef.current === recoveryPromise) {
          recoveryPromiseRef.current = null;
        }
      },
      () => {
        if (recoveryPromiseRef.current === recoveryPromise) {
          recoveryPromiseRef.current = null;
        }
      },
    );

    return recoveryPromise;
  }, [clearSession, refreshAccessToken, updateSession]);

  const retrySessionRecovery = useCallback(() => {
    setIsInitializing(true);
    return recoverStoredSession();
  }, [recoverStoredSession]);

  useEffect(() => {
    return registerAuthSessionHandlers({
      refreshAccessToken,
      onSessionExpired,
    });
  }, [onSessionExpired, refreshAccessToken]);

  useEffect(() => {
    void recoverStoredSession();
  }, [recoverStoredSession]);

  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!session) {
      return;
    }

    const scheduledAccessToken = session.accessToken;
    const delay = Math.max(
      0,
      session.expiresAt - Date.now() - REFRESH_LEAD_TIME_MS,
    );

    const refreshWhenNeeded = async () => {
      if (sessionRef.current?.accessToken !== scheduledAccessToken) {
        return;
      }

      try {
        await refreshAccessToken(scheduledAccessToken);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          onSessionExpired();
          return;
        }

        if (sessionRef.current?.accessToken === scheduledAccessToken) {
          refreshTimerRef.current = setTimeout(
            refreshWhenNeeded,
            NETWORK_RETRY_DELAY_MS,
          );
        }
      }
    };

    refreshTimerRef.current = setTimeout(refreshWhenNeeded, delay);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [onSessionExpired, refreshAccessToken, session]);

  const logout = useCallback(() => {
    const currentSession = sessionRef.current;

    clearSession();
    setSessionRecoveryError(null);

    if (currentSession) {
      void apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
      }).catch(() => undefined);
    }
  }, [clearSession]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const response = await apiRequest<ApiEnvelope<AuthResult>>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(credentials),
        },
      );

      const result = response.data;

      if (!isValidAuthResult(result)) {
        throw new Error("The API returned an invalid authentication response.");
      }

      updateSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: Date.now() + result.expiresIn * 1000,
        user: result.user,
      });
      setSessionRecoveryError(null);
      setIsInitializing(false);
    },
    [updateSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      isAuthenticated: Boolean(session),
      isInitializing,
      sessionRecoveryError,
      retrySessionRecovery,
      login,
      logout,
    }),
    [
      session,
      isInitializing,
      sessionRecoveryError,
      retrySessionRecovery,
      login,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
