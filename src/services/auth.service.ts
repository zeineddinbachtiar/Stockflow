import bcrypt from "bcryptjs";
import { AppError } from "../errors/app-error";
import { hasPostgresErrorCode } from "../utils/postgres-errors";

import {
  findUserByEmail,
  findUserById,
  createUser,
} from "../repositories/user.repositories";

import type {
  AuthResult,
  LoginInput,
  PublicUser,
  RegisterInput,
  UserRecord,
} from "../types/user.types";

import {
  createAuthSession,
  revokeAuthSession,
  rotateAuthSession,
} from "../repositories/auth-session.repositories";

import { generateRefreshToken, hashRefreshToken } from "../utils/refresh-token";

import { ACCESS_TOKEN_TTL_SECONDS, generateAccessToken } from "../utils/jwt";

// Password hashing configuration
const BCRYPT_SALT_ROUNDS = 12;
const BCRYPT_MAX_PASSWORD_BYTES = 72;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "stockflow-dummy-password-not-a-real-account",
  BCRYPT_SALT_ROUNDS,
);

// Convert database user into safe public user
function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at,
  };
}

/**
 * Build authentication response for an existing backend session.
 */
function createAuthResultForSession(
  user: UserRecord,
  sessionId: string,
  refreshToken: string,
): AuthResult {
  return {
    accessToken: generateAccessToken({
      id: user.id,
      role: user.role,
      sessionId,
    }),
    refreshToken,
    tokenType: "Bearer",
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: toPublicUser(user),
  };
}

/**
 * Create a new authentication session.
 */
async function createAuthResult(user: UserRecord): Promise<AuthResult> {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const sessionId = await createAuthSession(user.id, refreshTokenHash);

  return createAuthResultForSession(user, sessionId, refreshToken);
}

/**
 * Register new user.
 * Public registration always assigns SALES_STAFF role.
 */
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();

  // Validate basic input
  if (!fullName || !email) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "Full name and email are required.",
    );
  }

  if (input.password.length < 8) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "Password must contain at least 8 characters.",
    );
  }

  if (Buffer.byteLength(input.password, "utf8") > BCRYPT_MAX_PASSWORD_BYTES) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "Password must not exceed 72 UTF-8 bytes.",
    );
  }

  // Check whether email already exists
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new AppError(
      409,
      "EMAIL_ALREADY_REGISTERED",
      "Email is already registered.",
    );
  }

  // Hash password before saving
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  let user: UserRecord;

  try {
    user = await createUser({
      fullName,
      email,
      passwordHash,
      role: "SALES_STAFF",
    });
  } catch (error: unknown) {
    if (hasPostgresErrorCode(error, "23505")) {
      throw new AppError(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "Email is already registered.",
      );
    }

    throw error;
  }

  return createAuthResult(user);
}

/**
 * Authenticate existing user.
 *
 * Always execute one bcrypt comparison to reduce timing
 * differences between existing and nonexistent accounts.
 */
export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  if (
    !email ||
    !input.password ||
    Buffer.byteLength(input.password, "utf8") > BCRYPT_MAX_PASSWORD_BYTES
  ) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
    );
  }

  // Find user by email.
  const user = await findUserByEmail(email);

  // Use the real password hash if the user exists.
  // Otherwise use the dummy hash.
  const passwordHash = user ? user.password_hash : DUMMY_PASSWORD_HASH;

  // Always execute one bcrypt comparison.
  const isPasswordValid = await bcrypt.compare(input.password, passwordHash);

  // Reject missing, inactive, or invalid accounts.
  if (!user || !user.is_active || !isPasswordValid) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
    );
  }

  return createAuthResult(user);
}

/**
 * Refresh an authentication session using a one-time refresh token.
 *
 * The refresh token is rotated atomically before a new access token
 * is issued. Reusing the previous refresh token is rejected.
 */
export async function refreshUserSession(
  refreshToken: string,
): Promise<AuthResult> {
  const nextRefreshToken = generateRefreshToken();
  const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);

  const session = await rotateAuthSession(
    hashRefreshToken(refreshToken),
    nextRefreshTokenHash,
  );

  if (!session) {
    throw new AppError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token is invalid, expired, or revoked.",
    );
  }

  const user = await findUserById(session.user_id);

  if (!user || !user.is_active) {
    await revokeAuthSession(nextRefreshTokenHash);

    throw new AppError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token is invalid, expired, or revoked.",
    );
  }

  return createAuthResultForSession(user, session.id, nextRefreshToken);
}

/**
 * Revoke an authentication session.
 *
 * Logout is intentionally idempotent. Unknown or already revoked
 * tokens do not reveal whether a session previously existed.
 */
export async function logoutUser(refreshToken: string): Promise<void> {
  await revokeAuthSession(hashRefreshToken(refreshToken));
}
