
/**
 * Available user roles in StockFlow.
 */
export type UserRole =
  | "ADMIN"
  | "WAREHOUSE_STAFF"
  | "SALES_STAFF";

/**
 * User record returned directly from PostgreSQL.
 * This type contains sensitive password_hash data.
 */
export interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Safe user object that can be exposed to clients.
 * Never include password_hash here.
 */
export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Data required to create a new user.
 */
export interface CreateUserInput {
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

/**
 * Data required for registration.
 * The role is intentionally excluded.
 */
export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

/**
 * Data required for login.
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Authentication response.
 */
export interface AuthResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: PublicUser;
}
