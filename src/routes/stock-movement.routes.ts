import { Router } from "express";

import {
  listStockMovements,
  getStockMovement,
} from "../controllers/stock-movement.controller";

import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";

const router = Router();

// Only ADMIN and WAREHOUSE_STAFF can view stock movement history.
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "WAREHOUSE_STAFF"),
  listStockMovements,
);

router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "WAREHOUSE_STAFF"),
  getStockMovement,
);

export default router;
