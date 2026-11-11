import { Router } from "express";

import { register, login } from "../controllers/auth.controller";

import { validateBody } from "../middlewares/validate";

import { registerSchema, loginSchema } from "../validators/auth.validator";

import {
  loginRateLimiter,
  registrationRateLimiter,
} from "../middlewares/rate-limit";

const authRouter = Router();

// User registration
authRouter.post(
  "/register",
  registrationRateLimiter,
  validateBody(registerSchema),
  register,
);

// User login
authRouter.post("/login", loginRateLimiter, validateBody(loginSchema), login);

export default authRouter;
