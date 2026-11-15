import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { server } from "./test/mocks/server";

import type {
  AuthResult,
  AuthSession,
  AuthUser,
  UserRole,
} from "./types/auth.types";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const SESSION_KEY = "stockflow.auth.session";

const testCredentials = {
  email: "admin@stockflow.local",
  password: "valid-test-password",
};

const loginUser: AuthUser = {
  id: "user-001",
  fullName: "StockFlow Administrator",
  email: testCredentials.email,
  role: "ADMIN",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const loginResult: AuthResult = {
  accessToken: "integration-test-access-token",
  tokenType: "Bearer",
  expiresIn: 900,
  user: loginUser,
};

const loginSession: AuthSession = {
  accessToken: loginResult.accessToken,
  user: loginUser,
};

function success<T>(data: T) {
  return {
    status: "success" as const,
    data,
  };
}

function seedAuthenticatedSession(role: UserRole) {
  const user: AuthUser = {
    ...loginUser,
    role,
  };

  const session: AuthSession = {
    accessToken: `test-token-${role.toLowerCase()}`,
    user,
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return session;
}

function renderApp(initialPath = "/") {
  window.history.replaceState({}, "", initialPath);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function installDashboardHandlers() {
  server.use(
    http.get(`${API_URL}/products`, () =>
      HttpResponse.json(
        success({
          products: [],
          total: 0,
          limit: 1,
          offset: 0,
        }),
      ),
    ),

    http.get(`${API_URL}/warehouses`, () =>
      HttpResponse.json(
        success({
          warehouses: [],
          total: 0,
          limit: 1,
          offset: 0,
        }),
      ),
    ),

    http.get(`${API_URL}/inventory`, () =>
      HttpResponse.json(
        success({
          inventory: [],
          total: 0,
          limit: 5,
          offset: 0,
        }),
      ),
    ),

    http.get(`${API_URL}/orders`, ({ request }) => {
      const url = new URL(request.url);
      const isDraftQuery = url.searchParams.has("status");

      return HttpResponse.json(
        success({
          orders: [],
          total: 0,
          limit: isDraftQuery ? 1 : 5,
          offset: 0,
        }),
      );
    }),
  );
}

describe("App routing integration", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("redirects unauthenticated users from protected routes to login", async () => {
    renderApp("/inventory");

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: "Inventory" }),
    ).not.toBeInTheDocument();
  });

  it("renders the protected application workspace for authenticated users", () => {
    seedAuthenticatedSession("ADMIN");

    renderApp("/inventory");

    expect(
      screen.getByRole("heading", {
        name: "Inventory",
        level: 2,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Monitor stock balances across your warehouses."),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Inventory" })).toHaveAttribute(
      "href",
      "/inventory",
    );
  });

  it.each([
    {
      role: "ADMIN" as const,
      path: "/stock-movements",
      title: "Stock Movements",
      description: "Review receipts, issues, adjustments, and stock history.",
      navigation: "Stock Movements",
    },
    {
      role: "WAREHOUSE_STAFF" as const,
      path: "/stock-movements",
      title: "Stock Movements",
      description: "Review receipts, issues, adjustments, and stock history.",
      navigation: "Stock Movements",
    },
    {
      role: "ADMIN" as const,
      path: "/customers",
      title: "Customers",
      description: "Manage customer profiles and contact information.",
      navigation: "Customers",
    },
    {
      role: "SALES_STAFF" as const,
      path: "/customers",
      title: "Customers",
      description: "Manage customer profiles and contact information.",
      navigation: "Customers",
    },
  ])(
    "allows $role to access $path",
    ({ role, path, title, description, navigation }) => {
      seedAuthenticatedSession(role);

      renderApp(path);

      expect(
        screen.getByRole("heading", {
          name: title,
          level: 2,
        }),
      ).toBeInTheDocument();

      expect(screen.getByText(description)).toBeInTheDocument();

      expect(
        screen.getByRole("link", { name: navigation }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    {
      role: "SALES_STAFF" as const,
      path: "/stock-movements",
      restrictedNavigation: "Stock Movements",
    },
    {
      role: "WAREHOUSE_STAFF" as const,
      path: "/customers",
      restrictedNavigation: "Customers",
    },
  ])(
    "redirects unauthorized $role from $path to Dashboard",
    async ({ role, path, restrictedNavigation }) => {
      seedAuthenticatedSession(role);
      installDashboardHandlers();

      renderApp(path);

      expect(
        await screen.findByText("No low-stock records"),
      ).toBeInTheDocument();

      expect(
        screen.getByRole("heading", {
          name: "Dashboard",
          level: 2,
        }),
      ).toBeInTheDocument();

      expect(
        screen.queryByRole("link", {
          name: restrictedNavigation,
        }),
      ).not.toBeInTheDocument();
    },
  );

  it("completes login and opens the protected Dashboard through App routing", async () => {
    const user = userEvent.setup();

    installDashboardHandlers();

    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json({
          status: "success",
          message: "Login successful.",
          data: loginResult,
        }),
      ),
    );

    renderApp("/login");

    await user.type(
      screen.getByLabelText("Email address"),
      testCredentials.email,
    );

    await user.type(
      screen.getByLabelText("Password"),
      testCredentials.password,
    );

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("No low-stock records")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Dashboard",
        level: 2,
      }),
    ).toBeInTheDocument();

    expect(sessionStorage.getItem(SESSION_KEY)).toBe(
      JSON.stringify(loginSession),
    );
  });

  it("navigates between protected pages using the application Sidebar", async () => {
    const user = userEvent.setup();

    seedAuthenticatedSession("ADMIN");

    renderApp("/inventory");

    await user.click(screen.getByRole("link", { name: "Orders" }));

    expect(
      await screen.findByText(
        "Create and manage sales orders and fulfillment workflows.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Orders",
        level: 2,
      }),
    ).toBeInTheDocument();
  });

  it("renders the not-found page for an unknown authenticated route", () => {
    seedAuthenticatedSession("ADMIN");

    renderApp("/unknown-page");

    expect(
      screen.getByText("The requested page does not exist."),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Page not found",
      }),
    ).toBeInTheDocument();
  });
});
