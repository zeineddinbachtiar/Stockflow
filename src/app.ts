import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/auth.routes";
import categoryRouter from "./routes/category.routes";
import productRouter from "./routes/product.routes";
import warehouseRouter from "./routes/warehouse.routes";
import customerRouter from "./routes/customer.routes";

const app = express();

// Security middleware
app.use(helmet());

// Cross-origin resource sharing
app.use(cors());

// Parse incoming JSON requests
app.use(express.json());

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/warehouses", warehouseRouter);
app.use("/api/v1/customers", customerRouter);

// Health check endpoint
app.get("/api/v1/health", (_req, res) => {
  return res.status(200).json({
    status: "success",
    message: "StockFlow API is running",
    timestamp: new Date().toISOString()
  });
});

export default app;
