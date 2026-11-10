
import { Router } from "express";

import {
  register,
  login
} from "../controllers/auth.controller";

import {
  validateBody
} from "../middlewares/validate";

import {
  registerSchema,
  loginSchema
} from "../validators/auth.validator";

const authRouter = Router();

// User registration
authRouter.post(
  "/register",
  validateBody(registerSchema),
  register
);

// User login
authRouter.post(
  "/login",
  validateBody(loginSchema),
  login
);

export default authRouter;
