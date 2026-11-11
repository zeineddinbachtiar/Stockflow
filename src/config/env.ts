import "dotenv/config";
import { z } from "zod";

// 1. Define environment variable schema
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(3000),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://localhost:3000"),

  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

  DB_HOST: z.string().default("localhost"),

  DB_PORT: z.coerce.number().int().positive().default(5432),

  DB_NAME: z.string().min(1),

  DB_USER: z.string().min(1),

  DB_PASSWORD: z.string().min(1),

  JWT_SECRET: z.string().min(64, "JWT_SECRET must be at least 64 characters"),

  SEED_ADMIN_PASSWORD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(12).optional(),
  ),

  SEED_WAREHOUSE_PASSWORD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(12).optional(),
  ),

  SEED_SALES_PASSWORD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(12).optional(),
  ),
});

// 2. Validate environment variables.
const parsedEnv = envSchema.parse(process.env);

const corsAllowedOrigins = parsedEnv.CORS_ALLOWED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Require at least one valid origin.
if (corsAllowedOrigins.length === 0) {
  throw new Error("CORS_ALLOWED_ORIGINS must contain at least one origin.");
}

// Validate origin format.
for (const origin of corsAllowedOrigins) {
  let parsedOrigin: URL;

  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error(`Invalid CORS origin: ${origin}`);
  }

  if (
    !["http:", "https:"].includes(parsedOrigin.protocol) ||
    parsedOrigin.origin !== origin
  ) {
    throw new Error(
      `Invalid CORS origin: ${origin}. Use an HTTP(S) origin without a path or trailing slash.`,
    );
  }
}

// Production must explicitly configure its frontend origins.
if (
  parsedEnv.NODE_ENV === "production" &&
  !process.env.CORS_ALLOWED_ORIGINS?.trim()
) {
  throw new Error(
    "CORS_ALLOWED_ORIGINS must be explicitly configured in production.",
  );
}

export const env = {
  ...parsedEnv,
  CORS_ALLOWED_ORIGINS: corsAllowedOrigins,
};
