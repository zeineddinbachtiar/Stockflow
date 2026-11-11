
import type {
  RequestHandler,
  Response
} from "express";

import {
  AuthServiceError,
  registerUser,
  loginUser
} from "../services/auth.service";

import type {
  RegisterRequest,
  LoginRequest
} from "../validators/auth.validator";

/**
 * Handle known authentication errors.
 */
function handleAuthError(
  error: unknown,
  _res: Response
): never {
  throw error;
}
/**
 * POST /api/v1/auth/register
 */
export const register: RequestHandler = async (
  req,
  res
) => {
  try {
    const input = req.body as RegisterRequest;

    const result = await registerUser(input);

    res.status(201).json({
      status: "success",
      message: "Registration successful.",
      data: result
    });

  } catch (error) {
    handleAuthError(error, res);
  }
};

/**
 * POST /api/v1/auth/login
 */
export const login: RequestHandler = async (
  req,
  res
) => {
  try {
    const input = req.body as LoginRequest;

    const result = await loginUser(input);

    res.status(200).json({
      status: "success",
      message: "Login successful.",
      data: result
    });

  } catch (error) {
    handleAuthError(error, res);
  }
};
