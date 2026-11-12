export type LogContext = Record<
  string,
  string | number | boolean | null | undefined
>;

type LogLevel = "info" | "warn" | "error";

function writeLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {}),
  };

  const output = `${JSON.stringify(entry)}\n`;

  if (level === "error") {
    process.stderr.write(output);
    return;
  }

  process.stdout.write(output);
}

/**
 * Return safe error metadata without exposing raw messages or stack traces.
 */
export function getSafeErrorMetadata(error: unknown): LogContext {
  if (!(error instanceof Error)) {
    return { errorName: "UnknownError" };
  }

  const metadata: LogContext = {
    errorName: error.name || "Error",
  };

  const errorCode = "code" in error ? error.code : undefined;

  if (
    typeof errorCode === "string" &&
    /^[A-Za-z0-9_-]{1,64}$/.test(errorCode)
  ) {
    metadata.errorCode = errorCode;
  }

  return metadata;
}

export const logger = {
  info(message: string, context?: LogContext): void {
    writeLog("info", message, context);
  },

  warn(message: string, context?: LogContext): void {
    writeLog("warn", message, context);
  },

  error(message: string, context?: LogContext): void {
    writeLog("error", message, context);
  },
};
