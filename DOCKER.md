# StockFlow Docker Setup

## Requirements

- Docker Desktop
- Docker Compose v2

## Environment Setup

Configure the local `.env` file before starting Docker Compose.

Required variables:

- `POSTGRES_ADMIN_PASSWORD`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ALLOWED_ORIGINS`

The PostgreSQL administrator password must be different from the application database password.

The application database account is created as a non-superuser.

## Build and Start

Validate the Compose configuration:

```powershell
docker compose config --quiet
```

Build and start the application:

```powershell
docker compose up --build -d
```

Check container status:

```powershell
docker compose ps
```

View application logs:

```powershell
docker compose logs -f api
```

## Database Seeding

The database schema is initialized automatically when the PostgreSQL volume is created for the first time.

Demo users and sample data are not seeded automatically.

Configure the three `SEED_*_PASSWORD` variables in `.env`, then run:

```powershell
docker compose --profile tools run --rm seed
```

## API Endpoints

- Liveness: http://localhost:3000/api/v1/health
- Readiness: http://localhost:3000/api/v1/ready
- Interactive documentation: http://localhost:3000/api/v1/docs
- OpenAPI JSON: http://localhost:3000/api/v1/openapi.json

## Stop the Application

Stop containers without deleting database data:

```powershell
docker compose down
```

## Reset the Database

WARNING: This removes the PostgreSQL volume and all data stored in it.

```powershell
docker compose down -v
```

The schema will be initialized again on the next startup.

## Deployment Notes

The default Compose configuration binds the API to localhost for local development and demonstration.

Production deployment requires an appropriately configured reverse proxy, HTTPS, trusted proxy settings, production CORS origins, and secure secret management.
