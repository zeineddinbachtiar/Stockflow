import { env } from "./config/env";
import { pool } from "./config/database";
import app from "./app";
import { getSafeErrorMetadata, logger } from "./utils/logger";

const SHUTDOWN_TIMEOUT_MS = 10_000;

// Start HTTP server.
const server = app.listen(env.PORT, () => {
  logger.info("StockFlow API started.", {
    environment: env.NODE_ENV,
    port: env.PORT,
    url: `http://localhost:${env.PORT}`,
  });
});

let isShuttingDown = false;
let databaseShutdownPromise: Promise<void> | undefined;

/**
 * Close the database pool only once.
 */
function closeDatabase(): Promise<void> {
  databaseShutdownPromise ??= pool.end();

  return databaseShutdownPromise;
}

/**
 * Gracefully stop accepting requests, finish active connections,
 * and close the database connection pool.
 */
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info("StockFlow shutdown started.", { signal });

  // If the HTTP server never started, close the database directly.
  if (!server.listening) {
    try {
      await closeDatabase();

      logger.info("Database connections closed.");
    } catch (error) {
      logger.error("Database shutdown failed.", getSafeErrorMetadata(error));

      process.exitCode = 1;
    }

    return;
  }

  // Force remaining HTTP connections closed after the timeout.
  const forceCloseTimer = setTimeout(() => {
    logger.error(
      "Graceful shutdown timeout reached. Closing remaining HTTP connections.",
      { timeoutMs: SHUTDOWN_TIMEOUT_MS },
    );

    server.closeAllConnections();
  }, SHUTDOWN_TIMEOUT_MS);

  forceCloseTimer.unref();

  // Stop accepting new connections.
  server.close((error) => {
    clearTimeout(forceCloseTimer);

    if (error) {
      logger.error("HTTP server shutdown failed.", getSafeErrorMetadata(error));

      process.exitCode = 1;
    }

    // Close PostgreSQL only after the HTTP server has finished closing.
    void closeDatabase()
      .then(() => {
        logger.info("Database connections closed.");
      })
      .catch((dbError: unknown) => {
        logger.error(
          "Database shutdown failed.",
          getSafeErrorMetadata(dbError),
        );

        process.exitCode = 1;
      });
  });

  // Close idle keep-alive connections immediately.
  server.closeIdleConnections();
}

/**
 * Handle HTTP server errors, including startup failures.
 */
server.on("error", (error: NodeJS.ErrnoException) => {
  logger.error("HTTP server error.", getSafeErrorMetadata(error));

  process.exitCode = 1;

  // If startup failed, there is no HTTP server to shut down.
  if (!server.listening) {
    void closeDatabase().catch((dbError: unknown) => {
      logger.error(
        "Database shutdown failed after HTTP server error.",
        getSafeErrorMetadata(dbError),
      );
    });
  }
});

// Handle operating-system shutdown signals.
process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
