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

// Handle unmatched routes.
app.use(notFoundHandler);

// Centralized application error handler.
// This must be the last middleware.
app.use(errorHandler);

export default app;
