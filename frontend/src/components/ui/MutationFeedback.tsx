import { X } from "lucide-react";

type MutationFeedbackProps = {
  successMessage?: string | null;
  errorMessage?: string | null;
  errorTitle?: string;
  onDismissSuccess?: () => void;
  onDismissError?: () => void;
};

export default function MutationFeedback({
  successMessage,
  errorMessage,
  errorTitle = "Unable to complete operation",
  onDismissSuccess,
  onDismissError,
}: MutationFeedbackProps) {
  if (!successMessage && !errorMessage) return null;

  return (
    <>
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          <span>{successMessage}</span>
          {onDismissSuccess && (
            <button
              type="button"
              aria-label="Dismiss success message"
              onClick={onDismissSuccess}
              className="ml-3 shrink-0"
            >
              <X size={17} />
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <div>
            <p className="font-semibold text-red-800">{errorTitle}</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
          {onDismissError && (
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={onDismissError}
              className="shrink-0 text-red-500 hover:text-red-700"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
