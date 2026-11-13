export const USER_ROLES = ["ADMIN", "WAREHOUSE_STAFF", "SALES_STAFF"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
}

export interface ApiEnvelope<T> {
  status: "success";
  message?: string;
  data: T;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}
