
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
  res: Response
): void {
  if (error instanceof AuthServiceError) {
    switch (error.code) {
      case "EMAIL_ALREADY_REGISTERED":
        res.status(409).json({
          status: "error",
          code: error.code,
          message: error.message
        });
        return;

      case "INVALID_CREDENTIALS":
        res.status(401).json({
          status: "error",
          code: error.code,
          message: error.message
        });
        return;

      case "INVALID_INPUT":
        res.status(400).json({
          status: "error",
          code: error.code,
          message: error.message
        });
        return;
    }
  }

  // Do not expose internal database or server errors.
  console.error("Unexpected authentication error:", error);

  res.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected server error occurred."
  });
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
