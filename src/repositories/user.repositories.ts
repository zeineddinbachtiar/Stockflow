
import { pool } from "../config/database";
import type {
  CreateUserInput,
  UserRecord
} from "../types/user.types";

// Define selected database columns.
const USER_COLUMNS = `
  id,
  full_name,
  email,
  password_hash,
  role,
  is_active,
  created_at,
  updated_at
`;

/**
 * Find user by email.
 */
export async function findUserByEmail(
  email: string
): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `
      SELECT ${USER_COLUMNS}
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] ?? null;
}

/**
 * Find user by ID.
 */
export async function findUserById(
  id: string
): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `
      SELECT ${USER_COLUMNS}
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/**
 * Create a new user.
 */
export async function createUser(
  input: CreateUserInput
): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `
      INSERT INTO users (
        full_name,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4)
      RETURNING ${USER_COLUMNS}
    `,
    [
      input.fullName,
      input.email,
      input.passwordHash,
      input.role
    ]
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error("Failed to create user.");
  }

  return user;
}
