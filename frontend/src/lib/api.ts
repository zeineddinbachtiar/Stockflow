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

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
      {
        ...options,
        headers,
      },
    );
  } catch {
    throw new ApiError(
      "Cannot connect to StockFlow API. Check whether the backend is running.",
      0,
      "NETWORK_ERROR",
    );
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
