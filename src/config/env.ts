import "dotenv/config";
import { z } from "zod";

// 1. Define environment variable schema
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(3000),

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

// 2. Validate environment variables
export const env = envSchema.parse(process.env);
