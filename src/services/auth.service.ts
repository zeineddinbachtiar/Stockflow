
import bcrypt from "bcryptjs";

import {
  findUserByEmail,
  createUser
} from "../repositories/user.repositories";


import type {
  AuthResult,
  LoginInput,
  PublicUser,
  RegisterInput,
  UserRecord
} from "../types/user.types";


import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateAccessToken
} from "../utils/jwt";

// Password hashing configuration
const BCRYPT_SALT_ROUNDS = 12;
const BCRYPT_MAX_PASSWORD_BYTES = 72;

// Authentication service error definitions
export type AuthServiceErrorCode =
  | "EMAIL_ALREADY_REGISTERED"
  | "INVALID_CREDENTIALS"
  | "INVALID_INPUT";

export class AuthServiceError extends Error {
  constructor(
    public readonly code: AuthServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

// Convert database user into safe public user
function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at
  };
}

// Build authentication response
function createAuthResult(user: UserRecord): AuthResult {
  return {
    accessToken: generateAccessToken({
      id: user.id,
      role: user.role
    }),
    tokenType: "Bearer",
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: toPublicUser(user)
  };
}

// Check PostgreSQL unique constraint violation
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return (
    "code" in error &&
    error.code === "23505"
  );
}

/**
 * Register new user.
 * Public registration always assigns SALES_STAFF role.
 */
export async function registerUser(
  input: RegisterInput
): Promise<AuthResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();

  // Validate basic input
  if (!fullName || !email) {
    throw new AuthServiceError(
      "INVALID_INPUT",
      "Full name and email are required."
    );
  }

  if (input.password.length < 8) {
    throw new AuthServiceError(
      "INVALID_INPUT",
      "Password must contain at least 8 characters."
    );
  }

  if (
    Buffer.byteLength(input.password, "utf8") >
    BCRYPT_MAX_PASSWORD_BYTES
  ) {
    throw new AuthServiceError(
      "INVALID_INPUT",
      "Password must not exceed 72 UTF-8 bytes."
    );
  }

  // Check whether email already exists
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new AuthServiceError(
      "EMAIL_ALREADY_REGISTERED",
      "Email is already registered."
    );
  }

  // Hash password before saving
  const passwordHash = await bcrypt.hash(
    input.password,
    BCRYPT_SALT_ROUNDS
  );

  let user: UserRecord;

  try {
    user = await createUser({
      fullName,
      email,
      passwordHash,
      role: "SALES_STAFF"
    });
  } catch (error) {
    // Handle duplicate email race condition
    if (isUniqueViolation(error)) {
      throw new AuthServiceError(
        "EMAIL_ALREADY_REGISTERED",
        "Email is already registered."
      );
    }

    throw error;
  }

  return createAuthResult(user);
}

/**
 * Authenticate existing user.
 */
export async function loginUser(
  input: LoginInput
): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  if (
    !email ||
    !input.password ||
    Buffer.byteLength(input.password, "utf8") >
      BCRYPT_MAX_PASSWORD_BYTES
  ) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "Invalid email or password."
    );
  }

  // Find user by email
  const user = await findUserByEmail(email);

  // Use the same response for missing and inactive accounts
  if (!user || !user.is_active) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "Invalid email or password."
    );
  }

  // Compare submitted password with stored hash
  const isPasswordValid = await bcrypt.compare(
    input.password,
    user.password_hash
  );

  if (!isPasswordValid) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "Invalid email or password."
    );
  }

  return createAuthResult(user);
}
