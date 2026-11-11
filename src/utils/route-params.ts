
import { AppError } from "../errors/app-error";
import { positiveBigIntIdSchema } from "../validators/common.validator";

/**
 * Validate and return a positive PostgreSQL BIGINT route parameter.
 */
export function parsePositiveBigIntId(
  value: unknown,
  errorCode: string,
  resourceName: string
): string {
  const parsed = positiveBigIntIdSchema.safeParse(value);

  if (!parsed.success) {
    throw new AppError(
      400,
      errorCode,
      `${resourceName} ID must be a valid positive BIGINT.`
    );
  }

  return parsed.data;
}
