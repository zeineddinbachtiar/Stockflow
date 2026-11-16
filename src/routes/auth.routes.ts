import { Router } from "express";

import {
  register,
  login,
  refresh,
  logout,
} from "../controllers/auth.controller";

import { validateBody } from "../middlewares/validate";

import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from "../validators/auth.validator";

import {
  loginRateLimiter,
  registrationRateLimiter,
  refreshRateLimiter,
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

// Refresh an existing authentication session.
authRouter.post(
  "/refresh",
  refreshRateLimiter,
  validateBody(refreshSchema),
  refresh,
);

// Revoke an authentication session.
authRouter.post("/logout", validateBody(logoutSchema), logout);

export default authRouter;
