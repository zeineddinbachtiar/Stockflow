import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/auth.routes";
import categoryRouter from "./routes/category.routes";
import productRouter from "./routes/product.routes";
import warehouseRouter from "./routes/warehouse.routes";
import customerRouter from "./routes/customer.routes";
import inventoryRouter from "./routes/inventory.routes";
import stockMovementRouter from "./routes/stock-movement.routes";
import orderRouter from "./routes/order.routes";
import { notFoundHandler } from "./middlewares/not-found";
import { errorHandler } from "./middlewares/error-handler";
import { env } from "./config/env";
import { readinessCheck } from "./controllers/health.controller";
import { requestLogger } from "./middlewares/request-logger";
import { randomBytes } from "node:crypto";
import { apiReference } from "@scalar/express-api-reference";
import openApiDocument from "./docs/openapi.json";
import type { RequestHandler } from "express";

const app = express();

// Trust only the explicitly configured number of reverse-proxy hops.
app.set("trust proxy", env.TRUST_PROXY_HOPS);

// Attach request IDs and structured request logging.
app.use(requestLogger);

// Security middleware
app.use(helmet());

// Cross-origin resource sharing with an explicit origin allowlist.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header (e.g. Postman or server-to-server).
      if (!origin || env.CORS_ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      // Do not expose CORS headers to unapproved origins.
      callback(null, false);
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Parse incoming JSON requests
app.use(express.json());

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/warehouses", warehouseRouter);
app.use("/api/v1/customers", customerRouter);
app.use("/api/v1/inventory", inventoryRouter);
app.use("/api/v1/stock-movements", stockMovementRouter);
app.use("/api/v1/orders", orderRouter);

// Health check endpoint
app.get("/api/v1/health", (_req, res) => {
  return res.status(200).json({
    status: "success",
    message: "StockFlow API is running",
    timestamp: new Date().toISOString(),
  });
});

// Database readiness endpoint
app.get("/api/v1/ready", readinessCheck);

// Serve the OpenAPI specification.
app.get("/api/v1/openapi.json", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");

  return res.status(200).json(openApiDocument);
});

// Serve interactive Scalar API documentation.
app.get("/api/v1/docs", (req, res, next) => {
  const nonce = randomBytes(18).toString("base64");

  // Keep a strict script policy while allowing Scalar's trusted CDN.
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https: data:",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' data: https:",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    "script-src-attr 'none'",
    "style-src 'self' https: 'unsafe-inline'",
    "connect-src 'self'",
  ];

  if (env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }

  res.setHeader("Content-Security-Policy", directives.join("; "));
  res.setHeader("Cache-Control", "no-store");

  const scalarHandler = apiReference({
    url: "/api/v1/openapi.json",
    theme: "default",
    nonce,
  }) as unknown as RequestHandler;

  return scalarHandler(req, res, next);
});

// Handle unmatched routes.
app.use(notFoundHandler);

// Centralized application error handler.
// This must be the last middleware.
app.use(errorHandler);

export default app;
