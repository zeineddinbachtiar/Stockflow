interface LoadMoreOptionsProps {
  resource: string;
  hasMore: boolean;
  isLoading: boolean;
  error?: string | null;
  onLoadMore: () => void;
}

export default function LoadMoreOptions({
  resource,
  hasMore,
  isLoading,
  error = null,
  onLoadMore,
}: LoadMoreOptionsProps) {
  if (!hasMore && !error) return null;

  return (
    <div className="mt-1.5">
      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          Unable to load more {resource}: {error}
        </p>
      )}
      {hasMore && (
        <button
          type="button"
          disabled={isLoading}
          onClick={onLoadMore}
          className="text-xs font-semibold text-blue-700 underline disabled:opacity-50"
        >
          {isLoading
            ? `Loading more ${resource}...`
            : error
              ? `Retry loading more ${resource}`
              : `Load more ${resource}`}
        </button>
      )}
    </div>
  );
}
