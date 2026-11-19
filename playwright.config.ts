import { defineConfig, devices } from "@playwright/test";

const E2E_DATABASE_NAME = "stockflow_test_db";
const E2E_SCHEMA_NAME = process.env.E2E_SCHEMA_NAME ?? "";
const E2E_WEB_PORT = "5181";

if (
  process.env.STOCKFLOW_E2E_RUNNER !== "1" ||
  process.env.NODE_ENV !== "test" ||
  process.env.DB_NAME !== E2E_DATABASE_NAME ||
  !/^stockflow_e2e_[0-9a-f]{32}$/.test(E2E_SCHEMA_NAME) ||
  E2E_SCHEMA_NAME.length > 63
) {
  throw new Error("Run browser E2E tests with npm run test:e2e.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  reporter: "list",
  outputDir: "./test-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${E2E_WEB_PORT}`,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
