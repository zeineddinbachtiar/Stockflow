# StockFlow

**Inventory & Order Management REST API**

StockFlow is a RESTful API for managing product catalogs, warehouses, customers, inventory balances, stock movements, and sales orders. It provides JWT-based authentication, role-based access control, transactional stock operations, and interactive API documentation.

Built with Node.js, TypeScript, Express 5, and PostgreSQL.

## Features

- JWT authentication and role-based access control (RBAC).
- User registration and login.
- Category, product, warehouse, and customer management.
- Inventory management across multiple warehouses.
- Stock receipts, issues, and adjustments.
- Append-only stock movement history.
- Order creation, updating, confirmation, and cancellation.
- Atomic stock deduction and restoration during order workflows.
- Pagination and query validation.
- Centralized error handling.
- Request ID and structured JSON logging.
- CORS allowlist, security headers, and authentication rate limiting.
- OpenAPI 3.1 documentation with interactive Scalar UI.
- Docker and Docker Compose support.
- Automated integration tests with PostgreSQL.

## Tech Stack

| Component         | Technology                      |
| ----------------- | ------------------------------- |
| Runtime           | Node.js 22+                     |
| Language          | TypeScript                      |
| Backend framework | Express 5                       |
| Database          | PostgreSQL 18                   |
| Database driver   | node-postgres (`pg`)            |
| Validation        | Zod                             |
| Authentication    | JWT                             |
| Password hashing  | bcryptjs                        |
| API documentation | OpenAPI 3.1 / Scalar            |
| Testing           | Node.js Test Runner / Supertest |
| Code quality      | ESLint / Prettier               |
| Containerization  | Docker / Docker Compose         |
| CI                | GitHub Actions                  |

## Architecture Overview

StockFlow uses a layered backend architecture:

- **Routes** — define API endpoints and middleware.
- **Controllers** — handle HTTP requests and responses.
- **Services** — implement application and business logic.
- **Repositories** — handle database queries.
- **Validators** — validate request parameters and payloads.
- **Middlewares** — handle authentication, authorization, rate limiting, request logging, and errors.
- **Configuration** — manage environment variables and PostgreSQL connections.

## User Roles

StockFlow supports three application roles:

| Role              | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `ADMIN`           | Administrative access to master data and operational management. |
| `WAREHOUSE_STAFF` | Warehouse operations, stock management, and order fulfillment.   |
| `SALES_STAFF`     | Customer management and sales order operations.                  |

Public registration always creates a `SALES_STAFF` account. Clients cannot assign their own role.

Authorization uses the latest role stored in the database, rather than relying exclusively on the role contained in an existing JWT.

## Business Rules

### Inventory

- Inventory is tracked per product and warehouse.
- Stock cannot become negative.
- Stock operations are performed transactionally.
- Concurrent stock issues are protected against overselling.
- Successful stock operations generate stock movement records.

### Orders

Orders support three states:

- `DRAFT`
- `CONFIRMED`
- `CANCELLED`

Business rules:

- Creating a draft order does not change inventory.
- Order confirmation deducts inventory atomically.
- Cancelling a confirmed order restores the deducted inventory.
- Cancelled orders cannot be updated or cancelled again.
- Sales staff can only access their own orders.
- The server determines item pricing; clients cannot submit their own trusted unit prices.

### Stock Movement History

Stock movements are append-only audit records. Successful receipts, issues, adjustments, and order-related stock operations are recorded in the movement history.

### Pagination

List endpoints support offset pagination.

| Parameter | Default | Constraint  |
| --------- | ------: | ----------- |
| `limit`   |      50 | 1–100       |
| `offset`  |       0 | 0–1,000,000 |

Resource IDs use PostgreSQL BIGINT values and are serialized as strings in API responses.

## Quick Start — Docker

Docker Compose is the recommended way to run StockFlow locally.

### Requirements

- Docker Desktop
- Docker Compose v2

### 1. Clone the repository

```bash
git clone https://github.com/zeineddinbachtiar/Stockflow.git
cd Stockflow
```

### 2. Configure environment variables

Copy `.env.example` to `.env`:

**PowerShell:**

```powershell
Copy-Item .env.example .env
```

Configure the required environment variables:

- `POSTGRES_ADMIN_PASSWORD`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ALLOWED_ORIGINS`
- `SEED_ADMIN_PASSWORD`
- `SEED_WAREHOUSE_PASSWORD`
- `SEED_SALES_PASSWORD`

Use strong, unique passwords. The PostgreSQL administrator password must be different from the application database password.

Generate a JWT secret locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

Do not commit `.env` or share its contents.

### 3. Validate Docker Compose

```bash
docker compose config --quiet
```

### 4. Build and start the application

```bash
docker compose up --build -d
```

### 5. Check container health

```bash
docker compose ps
```

The API and PostgreSQL containers should report healthy status.

### 6. Seed demo data

Configure the three `SEED_*_PASSWORD` variables in `.env`, then run:

```bash
docker compose --profile tools run --rm seed
```

Seeding creates demo users and sample master data, inventory balances, and opening stock movements. Existing inventory quantities are not overwritten in the normal development seed operation.

Demo account emails:

| Role            | Email                       |
| --------------- | --------------------------- |
| ADMIN           | `admin@stockflow.local`     |
| WAREHOUSE_STAFF | `warehouse@stockflow.local` |
| SALES_STAFF     | `sales@stockflow.local`     |

Passwords are provided through environment variables and are not stored in this documentation.

## API Documentation

StockFlow provides interactive API documentation powered by Scalar.

| Resource                      | URL                                       |
| ----------------------------- | ----------------------------------------- |
| Interactive API documentation | http://localhost:3000/api/v1/docs         |
| OpenAPI JSON                  | http://localhost:3000/api/v1/openapi.json |
| Liveness check                | http://localhost:3000/api/v1/health       |
| Readiness check               | http://localhost:3000/api/v1/ready        |

The OpenAPI specification documents the available endpoints, authentication requirements, request parameters, request bodies, response schemas, and error responses.

### Authentication

StockFlow uses JWT Bearer access tokens.

1. Log in through `POST /api/v1/auth/login`.
2. Obtain the returned access token.
3. Authorize requests using:

```http
Authorization: Bearer <access-token>
```

Access tokens have a 15-minute lifetime.

## API Modules

The API is organized into the following resource groups:

| Module          | Base path                 | Description                       |
| --------------- | ------------------------- | --------------------------------- |
| Health          | `/api/v1/health`          | Application liveness              |
| Readiness       | `/api/v1/ready`           | Database readiness                |
| Authentication  | `/api/v1/auth`            | Registration and login            |
| Categories      | `/api/v1/categories`      | Category management               |
| Products        | `/api/v1/products`        | Product management                |
| Warehouses      | `/api/v1/warehouses`      | Warehouse management              |
| Customers       | `/api/v1/customers`       | Customer management               |
| Inventory       | `/api/v1/inventory`       | Inventory balances and operations |
| Stock Movements | `/api/v1/stock-movements` | Stock movement audit history      |
| Orders          | `/api/v1/orders`          | Sales order management            |

For complete route details, request and response schemas, and interactive API testing, see the Scalar documentation.

## Local Development Setup

### Requirements

- Node.js 22.13.0 or later
- PostgreSQL 18
- npm

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure environment variables

Create `.env` from `.env.example` and configure the local PostgreSQL connection, JWT secret, CORS origins, and seed passwords.

For local development, configure `DB_HOST` as `localhost` and `DB_PORT` as your PostgreSQL port.

### 3. Prepare the database

Create the application role and development database using a PostgreSQL administrator account.

The application database user should not be a superuser.

Apply the schema migration:

```bash
psql -h localhost -U stockflow_app -d stockflow_db -f database/migrations/001_create_stockflow_schema.sql
```

### 4. Seed demo data

```bash
npm run seed
```

### 5. Start development server

```bash
npm run dev
```

The API will be available at:

```text
http://localhost:3000
```

## Testing

StockFlow uses the built-in Node.js Test Runner and Supertest for automated integration testing.

Tests run against a dedicated PostgreSQL database named:

```text
stockflow_test_db
```

The test database must exist before running the test suite, with the configured application database credentials.

The `pretest` script automatically runs the test database bootstrap before executing tests. It verifies the database schema and prepares test fixtures.

### Run integration tests

```bash
npm test
```

### Run test TypeScript checks

```bash
npm run test:typecheck
```

### Run application TypeScript checks

```bash
npm run typecheck
```

### Run ESLint

```bash
npm run lint
```

### Check formatting

```bash
npm run format:check
```

### Build the application

```bash
npm run build
```

### Run production server

```bash
npm start
```

## Available npm Scripts

| Command                  | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `npm run dev`            | Start development server with watch mode          |
| `npm run build`          | Compile TypeScript                                |
| `npm start`              | Start compiled production application             |
| `npm run seed`           | Seed demo data                                    |
| `npm test`               | Bootstrap test database and run integration tests |
| `npm run test:db:setup`  | Prepare isolated test database                    |
| `npm run typecheck`      | Check application TypeScript                      |
| `npm run test:typecheck` | Check test TypeScript                             |
| `npm run lint`           | Run ESLint                                        |
| `npm run lint:fix`       | Automatically fix supported ESLint issues         |
| `npm run format`         | Format project files with Prettier                |
| `npm run format:check`   | Verify Prettier formatting                        |

## Security

Security controls implemented in StockFlow include:

- JWT Bearer authentication using HS256.
- Database-backed role authorization.
- Password hashing.
- CORS origin allowlist.
- Helmet security headers.
- Login rate limiting: 10 requests per IP per 15 minutes.
- Registration rate limiting: 5 requests per IP per hour.
- Explicit trusted reverse-proxy hop configuration.
- Centralized error handling.
- Request IDs and structured logging.
- Restricted PostgreSQL application user.
- Non-root Docker runtime.

The default rate limiter uses an in-memory store. A shared store such as Redis is required for consistent rate limiting across multiple application instances.

Production deployments must configure HTTPS, secure secret management, correct reverse-proxy settings, and actual frontend origins.

## Docker Operations

View application logs:

```bash
docker compose logs -f api
```

View database logs:

```bash
docker compose logs -f postgres
```

Stop the application without deleting persistent database data:

```bash
docker compose down
```

**Warning:** The following command removes the PostgreSQL Docker volume and permanently deletes the database data stored in it:

```bash
docker compose down -v
```

Use it only when intentionally resetting the Docker database.

Additional Docker instructions are available in [DOCKER.md](DOCKER.md).

## Continuous Integration

StockFlow uses GitHub Actions to automatically validate changes on pushes and pull requests targeting `main`.

The CI workflow includes:

- Dependency installation.
- PostgreSQL test service initialization.
- ESLint.
- Prettier format checks.
- Application and test TypeScript checks.
- Application build.
- Production dependency security audit.
- Integration tests.
- Docker Compose configuration validation.
- Docker image build.

Workflow definition:

```text
.github/workflows/ci.yml
```

## Project Structure

```text
Stockflow/
├── .github/
│   └── workflows/
│       └── ci.yml
├── database/
│   └── migrations/
├── docker/
│   └── postgres/
│       └── init/
├── scripts/
│   └── setup-test-db.mjs
├── src/
│   ├── config/
│   ├── controllers/
│   ├── docs/
│   │   └── openapi.json
│   ├── errors/
│   ├── middlewares/
│   ├── repositories/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   ├── types/
│   ├── utils/
│   ├── validators/
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── integration/
│   └── setup/
├── .dockerignore
├── .env.example
├── compose.yaml
├── Dockerfile
├── package.json
└── README.md
```

## Project Status

StockFlow has completed its core API implementation, automated integration testing, security hardening, production reliability improvements, OpenAPI documentation, Docker containerization, and GitHub Actions CI pipeline.

The project is intended as a backend engineering portfolio project demonstrating REST API development, relational database design, authentication and authorization, inventory transaction handling, automated testing, and containerized deployment.

## Repository

[StockFlow on GitHub](https://github.com/zeineddinbachtiar/Stockflow)
