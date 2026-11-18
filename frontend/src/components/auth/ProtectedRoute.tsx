import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../context/useAuth";

export default function ProtectedRoute() {
  const {
    isAuthenticated,
    isInitializing,
    sessionRecoveryError,
    retrySessionRecovery,
  } = useAuth();

  if (isInitializing) {
    return (
      <main
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center p-6 text-sm text-slate-600"
      >
        Restoring your session...
      </main>
    );
  }

  if (sessionRecoveryError) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <section
          role="alert"
          className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm"
        >
          <h1 className="font-semibold text-slate-900">
            Unable to restore your session
          </h1>
          <p className="mt-2 text-sm text-slate-600">{sessionRecoveryError}</p>
          <button
            type="button"
            onClick={() => void retrySessionRecovery()}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Retry session recovery
          </button>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
