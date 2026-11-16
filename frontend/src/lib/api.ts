const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

interface ApiErrorBody {
  code?: string;
  message?: string;
  errors?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: unknown,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface AuthSessionHandlers {
  refreshAccessToken: (rejectedAccessToken: string) => Promise<string>;
  onSessionExpired: () => void;
}

let authSessionHandlers: AuthSessionHandlers | null = null;
let refreshPromise: Promise<string> | null = null;

/**
 * Register the authentication session handlers.
 *
 * The returned function unregisters only the handler instance
 * that was originally registered.
 */
export function registerAuthSessionHandlers(
  handlers: AuthSessionHandlers,
): () => void {
  authSessionHandlers = handlers;

  return () => {
    if (authSessionHandlers === handlers) {
      authSessionHandlers = null;
    }
  };
}

function createRequestHeaders(
  options: RequestInit,
  accessToken?: string,
): Headers {
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

async function sendRequest(
  path: string,
  options: RequestInit,
  accessToken?: string,
): Promise<Response> {
  try {
    return await fetch(
      `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
      {
        ...options,
        headers: createRequestHeaders(options, accessToken),
      },
    );
  } catch {
    throw new ApiError(
      "Cannot connect to StockFlow API. Check whether the backend is running.",
      0,
      "NETWORK_ERROR",
    );
  }
}

/**
 * Share a single refresh operation between concurrent API requests.
 */
function getRefreshedAccessToken(
  handlers: AuthSessionHandlers,
  rejectedAccessToken: string,
): Promise<string> {
  if (!refreshPromise) {
    const currentPromise = Promise.resolve().then(() =>
      handlers.refreshAccessToken(rejectedAccessToken),
    );

    refreshPromise = currentPromise;

    const clearRefreshPromise = () => {
      if (refreshPromise === currentPromise) {
        refreshPromise = null;
      }
    };

    void currentPromise.then(clearRefreshPromise, clearRefreshPromise);
  }

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  let response = await sendRequest(path, options, accessToken);

  const handlers = authSessionHandlers;

  // Only authenticated requests are eligible for token refresh.
  if (response.status === 401 && accessToken && handlers) {
    try {
      const nextAccessToken = await getRefreshedAccessToken(
        handlers,
        accessToken,
      );

      response = await sendRequest(path, options, nextAccessToken);

      if (response.status === 401) {
        handlers.onSessionExpired();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handlers.onSessionExpired();
      }
    }
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = (payload ?? {}) as ApiErrorBody;

    throw new ApiError(
      errorBody.message ?? "The request could not be completed.",
      response.status,
      errorBody.code ?? "REQUEST_FAILED",
      errorBody.errors,
    );
  }

  return payload as T;
}
