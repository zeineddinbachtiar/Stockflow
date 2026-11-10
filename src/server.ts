import { env } from "./config/env";
import { pool } from "./config/database";
import app from "./app";

// Start HTTP server
const server = app.listen(env.PORT, () => {
  console.log("--------------------------------");
  console.log("STOCKFLOW API STARTED");
  console.log("--------------------------------");
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Port: ${env.PORT}`);
  console.log(
    `URL: http://localhost:${env.PORT}`
  );
});

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(): Promise<void> {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log("Shutting down StockFlow...");

  server.close(async (error) => {
    if (error) {
      console.error("HTTP server shutdown error:", error);
      process.exitCode = 1;
    }

    try {
      await pool.end();
      console.log("Database connections closed.");
    } catch (dbError) {
      console.error("Database shutdown error:", dbError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
