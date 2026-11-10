
import { Router } from "express";

import {
  listProducts,
  getProduct,
  createProductController,
  updateProductController,
  deactivateProductController,
} from "../controllers/product.controller";

import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { validateBody } from "../middlewares/validate";

import {
  createProductSchema,
  updateProductSchema,
} from "../validators/product.validator";

const router = Router();

// All authenticated users can view products.
router.get(
  "/",
  authenticate,
  listProducts
);

router.get(
  "/:id",
  authenticate,
  getProduct
);

// Only ADMIN can create products.
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateBody(createProductSchema),
  createProductController
);

// Only ADMIN can update products.
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateBody(updateProductSchema),
  updateProductController
);

// Only ADMIN can deactivate products.
router.patch(
  "/:id/deactivate",
  authenticate,
  authorize("ADMIN"),
  deactivateProductController
);

export default router;
