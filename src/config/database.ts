import { Pool } from "pg";
import { env } from "./env";
import { getSafeErrorMetadata, logger } from "../utils/logger";

// 1. Create PostgreSQL connection pool
export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,

  // Connection pool configuration
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,

  application_name: "stockflow-api",
});

// 2. Handle unexpected pool errors without exposing sensitive details.
pool.on("error", (error) => {
  logger.error(
    "Unexpected PostgreSQL pool error.",
    getSafeErrorMetadata(error),
  );
});
