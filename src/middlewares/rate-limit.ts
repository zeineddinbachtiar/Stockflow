import { rateLimit } from "express-rate-limit";

import { env } from "../config/env";

interface RateLimitPolicy {
  windowMs: number;
  limit: number;
  message: string;
  skipInTest?: boolean;
}

/**
 * Create a reusable rate-limiting middleware.
 *
 * Application routes skip rate limiting during automated tests.
 * Dedicated tests can disable this behavior using skipInTest: false.
 */
export function createRateLimitMiddleware(policy: RateLimitPolicy) {
  const skipInTest = policy.skipInTest ?? true;

  return rateLimit({
    windowMs: policy.windowMs,
    limit: policy.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      status: "error",
      code: "RATE_LIMIT_EXCEEDED",
      message: policy.message,
    },
    skip: skipInTest ? () => env.NODE_ENV === "test" : undefined,
  });
}

/**
 * Login: maximum 10 requests per IP every 15 minutes.
 */
export const loginRateLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many login attempts. Please try again after 15 minutes.",
});

/**
 * Registration: maximum 5 requests per IP every hour.
 */
export const registrationRateLimiter = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Too many registration attempts. Please try again after one hour.",
});
