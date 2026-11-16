interface QueryStateMessageProps {
  resource: string;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export default function QueryStateMessage({
  resource,
  isLoading,
  isError,
  isEmpty,
  errorMessage,
  onRetry,
}: QueryStateMessageProps) {
  if (isLoading) {
    return (
      <p className="mt-1.5 text-xs text-slate-400">Loading {resource}...</p>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-red-600"
      >
        <span>
          Unable to load {resource}:{" "}
          {errorMessage ?? "An unexpected error occurred."}
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <p className="mt-1.5 text-xs text-amber-600">No {resource} available.</p>
    );
  }

  return null;
}
