const dotenv = require("dotenv");

// Load local environment configuration.
dotenv.config();

// Do not allow test execution under production mode.
if (process.env.NODE_ENV === "production") {
  throw new Error("Automated tests cannot run with NODE_ENV=production.");
}

// Force test environment.
process.env.NODE_ENV = "test";

// Always use the dedicated testing database.
process.env.DB_NAME = "stockflow_test_db";

// Verify required configuration.
const requiredVariables = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
];

const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  throw new Error(`Missing test configuration: ${missingVariables.join(", ")}`);
}

console.log(`[TEST ENV] NODE_ENV=${process.env.NODE_ENV}`);

console.log(`[TEST ENV] DB_NAME=${process.env.DB_NAME}`);
