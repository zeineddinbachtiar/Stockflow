import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../../src/app";
import { env } from "../../src/config/env";
import { pool } from "../../src/config/database";

interface AuthApiBody {
  status?: string;
  code?: string;
  message?: string;
  data?: {
    accessToken?: unknown;
    tokenType?: string;
    expiresIn?: number;
    user?: {
      id?: string;
      fullName?: string;
      email?: string;
      role?: string;
      isActive?: boolean;
    };
  };
}

interface ApiResponse {
  status: number;
  body: AuthApiBody;
}

interface AuthSession {
  accessToken: string;
  userId: string;
  email: string;
  role: string;
}

const runId = randomUUID();

const createdTestEmails: string[] = [];
const createdCategoryNames: string[] = [];

function expectAuthSuccess(
  response: ApiResponse,
  expectedStatus: number,
  expectedRole: string,
): AuthSession {
  assert.equal(response.status, expectedStatus, JSON.stringify(response.body));

  assert.equal(response.body.status, "success");

  const data = response.body.data;
  assert.ok(data, "Authentication response data is missing.");

  const user = data.user;
  assert.ok(user, "Authentication user data is missing.");

  const accessToken = data.accessToken;
  const userId = user.id;
  const email = user.email;

  assert.equal(typeof accessToken, "string");
  assert.equal(data.tokenType, "Bearer");
  assert.equal(user.role, expectedRole);
  assert.equal(user.isActive, true);

  assert.ok(userId, "User ID must be returned.");
  assert.ok(email, "User email must be returned.");

  return {
    accessToken: accessToken as string,
    userId,
    email,
    role: expectedRole,
  };
}

async function registerTestUser(label: string): Promise<AuthSession> {
  const email = `module3-${runId}-${label}@example.test`;

  createdTestEmails.push(email);

  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({
      fullName: `Module 3 ${label}`,
      email,
      password: "Module3-Test-Password-2026",
    });

  const session = expectAuthSuccess(response, 201, "SALES_STAFF");

  assert.equal(session.email, email);

  return session;
}

// Cleanup test data and close PostgreSQL connections.
after(async () => {
  try {
    if (createdCategoryNames.length > 0) {
      await pool.query("DELETE FROM categories WHERE name = ANY($1::text[])", [
        createdCategoryNames,
      ]);
    }

    if (createdTestEmails.length > 0) {
      await pool.query("DELETE FROM users WHERE email = ANY($1::text[])", [
        createdTestEmails,
      ]);
    }
  } finally {
    await pool.end();
  }
});

// --------------------------------------------------
// 1. LOGIN FOR ALL SEEDED ROLES
// --------------------------------------------------

test("seeded ADMIN, WAREHOUSE_STAFF, and SALES_STAFF can login", async () => {
  const accounts = [
    {
      email: "admin@stockflow.local",
      password: env.SEED_ADMIN_PASSWORD,
      role: "ADMIN",
    },
    {
      email: "warehouse@stockflow.local",
      password: env.SEED_WAREHOUSE_PASSWORD,
      role: "WAREHOUSE_STAFF",
    },
    {
      email: "sales@stockflow.local",
      password: env.SEED_SALES_PASSWORD,
      role: "SALES_STAFF",
    },
  ];

  for (const account of accounts) {
    assert.ok(
      account.password,
      `Seed password for ${account.role} is not configured.`,
    );

    const response = await request(app).post("/api/v1/auth/login").send({
      email: account.email,
      password: account.password,
    });

    const session = expectAuthSuccess(response, 200, account.role);

    assert.equal(session.email, account.email);

    const protectedResponse = await request(app)
      .get("/api/v1/categories")
      .set("Authorization", `Bearer ${session.accessToken}`);

    assert.equal(
      protectedResponse.status,
      200,
      `${account.role} should access categories.`,
    );
  }
});

// --------------------------------------------------
// 2. REGISTRATION
// --------------------------------------------------

test("public registration always creates SALES_STAFF", async () => {
  const email = `module3-${runId}-registration@example.test`;

  createdTestEmails.push(email);

  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({
      fullName: "Module 3 Registration Test",
      email: ` ${email.toUpperCase()} `,
      password: "Module3-Test-Password-2026",
    });

  const session = expectAuthSuccess(response, 201, "SALES_STAFF");

  assert.equal(session.email, email);
});

test("registered user can login with the new credentials", async () => {
  const email = `module3-${runId}-newlogin@example.test`;
  const password = "Module3-New-Password-2026";

  createdTestEmails.push(email);

  const registerResponse = await request(app)
    .post("/api/v1/auth/register")
    .send({
      fullName: "Module 3 Login Test",
      email,
      password,
    });

  expectAuthSuccess(registerResponse, 201, "SALES_STAFF");

  const loginResponse = await request(app).post("/api/v1/auth/login").send({
    email,
    password,
  });

  const session = expectAuthSuccess(loginResponse, 200, "SALES_STAFF");

  assert.equal(session.email, email);
});

test("duplicate registration returns HTTP 409", async () => {
  const session = await registerTestUser("duplicate");

  const response = await request(app).post("/api/v1/auth/register").send({
    fullName: "Duplicate Registration",
    email: session.email,
    password: "Module3-Test-Password-2026",
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "EMAIL_ALREADY_REGISTERED");
});

// --------------------------------------------------
// 3. INPUT VALIDATION
// --------------------------------------------------

test("registration rejects invalid email", async () => {
  const response = await request(app).post("/api/v1/auth/register").send({
    fullName: "Invalid Email Test",
    email: "not-an-email",
    password: "Module3-Test-Password-2026",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});

test("registration rejects short password", async () => {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({
      fullName: "Short Password Test",
      email: `module3-${runId}-short@example.test`,
      password: "123",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});

test("registration rejects client-supplied role", async () => {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({
      fullName: "Role Injection Test",
      email: `module3-${runId}-role@example.test`,
      password: "Module3-Test-Password-2026",
      role: "ADMIN",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});

test("login rejects invalid email format", async () => {
  const response = await request(app).post("/api/v1/auth/login").send({
    email: "invalid-email",
    password: "some-password",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});

// --------------------------------------------------
// 4. LOGIN SECURITY
// --------------------------------------------------

test("unknown email and wrong password return identical errors", async () => {
  assert.ok(env.SEED_SALES_PASSWORD, "SEED_SALES_PASSWORD must be configured.");

  const wrongPasswordResponse = await request(app)
    .post("/api/v1/auth/login")
    .send({
      email: "sales@stockflow.local",
      password: "Definitely-Wrong-Password-2026",
    });

  const unknownEmailResponse = await request(app)
    .post("/api/v1/auth/login")
    .send({
      email: `unknown-${runId}@example.test`,
      password: "Definitely-Wrong-Password-2026",
    });

  assert.equal(wrongPasswordResponse.status, 401);
  assert.equal(unknownEmailResponse.status, 401);

  assert.equal(wrongPasswordResponse.body.code, "INVALID_CREDENTIALS");

  assert.equal(unknownEmailResponse.body.code, "INVALID_CREDENTIALS");

  assert.equal(
    wrongPasswordResponse.body.message,
    unknownEmailResponse.body.message,
  );
});

// --------------------------------------------------
// 5. AUTHENTICATION MIDDLEWARE
// --------------------------------------------------

test("protected endpoint rejects missing token", async () => {
  const response = await request(app).get("/api/v1/categories");

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "AUTHENTICATION_REQUIRED");
});

test("protected endpoint rejects invalid authorization format", async () => {
  const response = await request(app)
    .get("/api/v1/categories")
    .set("Authorization", "Basic invalid-token");

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "INVALID_AUTHORIZATION_FORMAT");
});

test("protected endpoint rejects invalid JWT", async () => {
  const response = await request(app)
    .get("/api/v1/categories")
    .set("Authorization", "Bearer invalid.token.value");

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "INVALID_ACCESS_TOKEN");
});

test("disabled user cannot use an existing access token", async () => {
  const session = await registerTestUser("disabled");

  await pool.query("UPDATE users SET is_active = FALSE WHERE id = $1", [
    session.userId,
  ]);

  const response = await request(app)
    .get("/api/v1/categories")
    .set("Authorization", `Bearer ${session.accessToken}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "INVALID_ACCESS_TOKEN");
});

// --------------------------------------------------
// 6. DYNAMIC ROLE AUTHORIZATION
// --------------------------------------------------

test("authorization uses the latest role stored in database", async () => {
  const session = await registerTestUser("dynamic-role");

  const categoryName = `M3 Auth ${runId}`;

  createdCategoryNames.push(categoryName);

  const initialResponse = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${session.accessToken}`)
    .send({
      name: categoryName,
      description: "Automated authorization test.",
    });

  assert.equal(initialResponse.status, 403);
  assert.equal(initialResponse.body.code, "FORBIDDEN");

  // Change the role directly in the test database.
  await pool.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [
    session.userId,
  ]);

  // The same token must now have ADMIN permissions.
  const promotedResponse = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${session.accessToken}`)
    .send({
      name: categoryName,
      description: "Automated authorization test.",
    });

  assert.equal(
    promotedResponse.status,
    201,
    JSON.stringify(promotedResponse.body),
  );

  // Restore the SALES_STAFF role.
  await pool.query("UPDATE users SET role = 'SALES_STAFF' WHERE id = $1", [
    session.userId,
  ]);

  // The same token must lose ADMIN permissions again.
  const demotedResponse = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${session.accessToken}`)
    .send({
      name: `M3 Denied ${runId}`,
      description: "Must not be created.",
    });

  assert.equal(demotedResponse.status, 403);
  assert.equal(demotedResponse.body.code, "FORBIDDEN");
});
