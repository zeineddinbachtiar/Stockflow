
import { Router } from "express";

import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { validateBody } from "../middlewares/validate";

import {
  cancelOrderController,
  confirmOrderController,
  createOrderController,
  getOrder,
  listOrders,
  updateOrderController
} from "../controllers/order.controller";

import {
  createOrderSchema,
  updateOrderSchema
} from "../validators/order.validator";

const router = Router();

// All order endpoints require authentication.
router.use(authenticate);

// Read access.
router.get("/", listOrders);
router.get("/:id", getOrder);

// Create and edit draft orders.
router.post(
  "/",
  authorize("ADMIN", "SALES_STAFF"),
  validateBody(createOrderSchema),
  createOrderController
);

router.patch(
  "/:id",
  authorize("ADMIN", "SALES_STAFF"),
  validateBody(updateOrderSchema),
  updateOrderController
);

// Confirm draft orders.
router.post(
  "/:id/confirm",
  authorize("ADMIN", "WAREHOUSE_STAFF"),
  confirmOrderController
);

// Cancellation rules are checked again inside the service.
router.post(
  "/:id/cancel",
  authorize("ADMIN", "WAREHOUSE_STAFF", "SALES_STAFF"),
  cancelOrderController
);

export default router;
