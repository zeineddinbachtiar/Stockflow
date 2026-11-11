import { Router } from "express";

import {
  listWarehouses,
  getWarehouse,
  createWarehouseController,
  updateWarehouseController,
  deactivateWarehouseController,
  reactivateWarehouseController,
} from "../controllers/warehouse.controller";

import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { validateBody } from "../middlewares/validate";

import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "../validators/warehouse.validator";

const router = Router();

// All authenticated users can view warehouses.
router.get("/", authenticate, listWarehouses);

router.get("/:id", authenticate, getWarehouse);

// Only ADMIN can create warehouses.
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateBody(createWarehouseSchema),
  createWarehouseController,
);

// Only ADMIN can update warehouses.
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateBody(updateWarehouseSchema),
  updateWarehouseController,
);

// Only ADMIN can deactivate warehouses.
router.patch(
  "/:id/deactivate",
  authenticate,
  authorize("ADMIN"),
  deactivateWarehouseController,
);

// Only ADMIN can reactivate warehouses.
router.patch(
  "/:id/reactivate",
  authenticate,
  authorize("ADMIN"),
  reactivateWarehouseController,
);

export default router;
