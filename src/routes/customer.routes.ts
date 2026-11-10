import { Router } from "express";

import {
  listCustomers,
  getCustomer,
  createCustomerController,
  updateCustomerController,
} from "../controllers/customer.controller";

import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { validateBody } from "../middlewares/validate";

import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../validators/customer.validator";

const router = Router();

// ADMIN and SALES_STAFF can view customers.
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "SALES_STAFF"),
  listCustomers
);

router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "SALES_STAFF"),
  getCustomer
);

// ADMIN and SALES_STAFF can create customers.
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "SALES_STAFF"),
  validateBody(createCustomerSchema),
  createCustomerController
);

// ADMIN and SALES_STAFF can update customers.
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "SALES_STAFF"),
  validateBody(updateCustomerSchema),
  updateCustomerController
);

export default router;