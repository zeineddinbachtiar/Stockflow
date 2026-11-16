import type { RequestHandler } from "express";

import {
  registerUser,
  loginUser,
  refreshUserSession,
  logoutUser,
} from "../services/auth.service";

import type {
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  LogoutRequest,
} from "../validators/auth.validator";

/**
 * POST /api/v1/auth/register
 */
export const register: RequestHandler = async (req, res) => {
  const input = req.body as RegisterRequest;

  const result = await registerUser(input);

  res.status(201).json({
    status: "success",
    message: "Registration successful.",
    data: result,
  });
};

/**
 * POST /api/v1/auth/login
 */
export const login: RequestHandler = async (req, res) => {
  const input = req.body as LoginRequest;

  const result = await loginUser(input);

  res.status(200).json({
    status: "success",
    message: "Login successful.",
    data: result,
  });
};

/**
 * POST /api/v1/auth/refresh
 */
export const refresh: RequestHandler = async (req, res) => {
  const input = req.body as RefreshRequest;

  const result = await refreshUserSession(input.refreshToken);

  res.status(200).json({
    status: "success",
    message: "Session refreshed successfully.",
    data: result,
  });
};

/**
 * POST /api/v1/auth/logout
 */
export const logout: RequestHandler = async (req, res) => {
  const input = req.body as LogoutRequest;

  await logoutUser(input.refreshToken);

  res.status(200).json({
    status: "success",
    message: "Logout successful.",
  });
};
