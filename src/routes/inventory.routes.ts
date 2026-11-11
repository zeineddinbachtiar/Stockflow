import { Router } from "express";

import {
  listInventory,
  getInventory,
  receiveStockController,
  issueStockController,
  adjustStockController,
  updateReorderLevelController,
} from "../controllers/inventory.controller";

import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { validateBody } from "../middlewares/validate";

import {
  receiveStockSchema,
  issueStockSchema,
  adjustStockSchema,
  reorderLevelSchema,
} from "../validators/inventory.validator";

const router = Router();

// All authenticated users can view inventory.
router.get("/", authenticate, listInventory);

router.get("/:id", authenticate, getInventory);

// ADMIN and WAREHOUSE_STAFF can receive stock.
router.post(
  "/receipts",
  authenticate,
  authorize("ADMIN", "WAREHOUSE_STAFF"),
  validateBody(receiveStockSchema),
  receiveStockController,
);

// ADMIN and WAREHOUSE_STAFF can issue stock.
router.post(
  "/issues",
  authenticate,
  authorize("ADMIN", "WAREHOUSE_STAFF"),
  validateBody(issueStockSchema),
  issueStockController,
);

// ADMIN and WAREHOUSE_STAFF can perform stock adjustments.
router.post(
  "/adjustments",
  authenticate,
  authorize("ADMIN", "WAREHOUSE_STAFF"),
  validateBody(adjustStockSchema),
  adjustStockController,
);

// ADMIN and WAREHOUSE_STAFF can update reorder levels.
router.patch(
  "/:id/reorder-level",
  authenticate,
  authorize("ADMIN", "WAREHOUSE_STAFF"),
  validateBody(reorderLevelSchema),
  updateReorderLevelController,
);

export default router;
