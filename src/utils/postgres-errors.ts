/**
 * Check whether an unknown error contains a PostgreSQL SQLSTATE code.
 */
export function hasPostgresErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return "code" in error && error.code === code;
}
