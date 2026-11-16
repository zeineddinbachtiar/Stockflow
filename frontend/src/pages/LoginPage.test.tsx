import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

import { AuthProvider } from "../context/AuthContext";
import { server } from "../test/mocks/server";

import type { AuthResult, AuthSession, AuthUser } from "../types/auth.types";

import LoginPage from "./LoginPage";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const SESSION_KEY = "stockflow.auth.session";

const credentials = {
  email: "admin@stockflow.local",
  password: "valid-test-password",
};

const testUser: AuthUser = {
  id: "user-001",
  fullName: "StockFlow Administrator",
  email: "admin@stockflow.local",
  role: "ADMIN",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const authResult: AuthResult = {
  accessToken: "test-signed-access-token",
  refreshToken: "test-refresh-token",
  tokenType: "Bearer",
  expiresIn: 900,
  user: testUser,
};

const expiresAt = Date.now() + authResult.expiresIn * 1000;

const storedSession: AuthSession = {
  accessToken: authResult.accessToken,
  refreshToken: authResult.refreshToken,
  expiresAt,
  user: testUser,
};

function renderLoginPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Dashboard route reached</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders the login form with required input constraints", () => {
    renderLoginPage();

    expect(
      screen.getByRole("heading", { name: "StockFlow" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    const emailInput = screen.getByLabelText("Email address");
    const passwordInput = screen.getByLabelText("Password");

    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toBeRequired();
    expect(emailInput).toHaveAttribute("maxlength", "150");

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toBeRequired();

    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("authenticates successfully and redirects to Dashboard", async () => {
    const user = userEvent.setup();

    let receivedBody: unknown;

    server.use(
      http.post(`${API_URL}/auth/login`, async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json({
          status: "success",
          message: "Login successful.",
          data: authResult,
        });
      }),
    );

    renderLoginPage();

    await user.type(screen.getByLabelText("Email address"), credentials.email);

    await user.type(screen.getByLabelText("Password"), credentials.password);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Dashboard route reached"),
    ).toBeInTheDocument();

    expect(receivedBody).toEqual(credentials);

    const persistedSession = JSON.parse(
      sessionStorage.getItem(SESSION_KEY)!,
    ) as AuthSession;

    expect(persistedSession).toMatchObject({
      accessToken: storedSession.accessToken,
      refreshToken: storedSession.refreshToken,
      user: storedSession.user,
    });
    expect(persistedSession.expiresAt).toBeGreaterThan(Date.now());
  });

  it("displays authentication errors when credentials are invalid", async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(
          {
            status: "error",
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          },
          { status: 401 },
        ),
      ),
    );

    renderLoginPage();

    await user.type(screen.getByLabelText("Email address"), credentials.email);

    await user.type(screen.getByLabelText("Password"), credentials.password);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );

    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();

    expect(
      screen.queryByText("Dashboard route reached"),
    ).not.toBeInTheDocument();

    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("disables the submit button while login is processing", async () => {
    const user = userEvent.setup();

    let releaseResponse!: () => void;

    const pendingResponse = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    server.use(
      http.post(`${API_URL}/auth/login`, async () => {
        await pendingResponse;

        return HttpResponse.json({
          status: "success",
          message: "Login successful.",
          data: authResult,
        });
      }),
    );

    renderLoginPage();

    await user.type(screen.getByLabelText("Email address"), credentials.email);

    await user.type(screen.getByLabelText("Password"), credentials.password);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const loadingButton = screen.getByRole("button", {
      name: "Signing in...",
    });

    expect(loadingButton).toBeDisabled();

    releaseResponse();

    expect(
      await screen.findByText("Dashboard route reached"),
    ).toBeInTheDocument();
  });

  it("redirects authenticated users away from the login page", async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));

    renderLoginPage();

    expect(
      await screen.findByText("Dashboard route reached"),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });
});
