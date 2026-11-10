
import { Router } from "express";

import {
  listCategories,
  getCategory,
  createCategoryController,
  updateCategoryController,
  deactivateCategoryController,
} from "../controllers/category.controller";

import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { validateBody } from "../middlewares/validate";

import {
  createCategorySchema,
  updateCategorySchema,
} from "../validators/category.validator";

const router = Router();

// All authenticated users can view categories.
router.get(
  "/",
  authenticate,
  listCategories
);

router.get(
  "/:id",
  authenticate,
  getCategory
);

// Only ADMIN can create categories.
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateBody(createCategorySchema),
  createCategoryController
);

// Only ADMIN can update categories.
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateBody(updateCategorySchema),
  updateCategoryController
);

// Only ADMIN can deactivate categories.
router.patch(
  "/:id/deactivate",
  authenticate,
  authorize("ADMIN"),
  deactivateCategoryController
);

export default router;
