# DropX

## Deploy the API with Docker Compose

The Compose stack runs the DropX API on port `8005` and MySQL 8.4 with persistent storage. It reuses the existing `sbx-redis-staging` container through Redis port `6379`. SMTP remains an external service configured through the API environment file.

### 1. Configure the deployment

Create the Compose environment file for MySQL credentials:

```bash
cp compose.env.example .env
```

Replace the example database passwords in `.env`. Because Compose uses `MYSQL_PASSWORD` inside a connection URL, use a URL-safe password containing letters, numbers, hyphens, or underscores.

The default `REDIS_URL` is `redis://host.docker.internal:6379`, which reaches the Redis port published by `sbx-redis-staging`. If that Redis instance requires authentication, set `REDIS_URL` to `redis://:password@host.docker.internal:6379` instead. The Compose file also maps `host.docker.internal` on Linux.

Create the API environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Set the production values in `apps/api/.env`, including:

- `API_BASE_URL` — the public API URL, including port `8005` when applicable.
- `API_CORS_ORIGINS` — allowed web, admin, and rider application origins.
- `APP_SECRET` — a unique secret of at least 32 characters.
- `MAIL_FROM`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, and `MAIL_PASSWORD`.
- `MAIL_BRAND_ASSET_URL` — a public HTTPS URL for the email logo.
- `BOOTSTRAP_TOKEN` — an optional one-time token for creating the first administrator.

Compose supplies `NODE_ENV=production`, `API_PORT=8005`, the internal `DATABASE_URL`, and the root `.env` value for `REDIS_URL`; those values do not need to be changed in `apps/api/.env`.

### 2. Build the API image

```bash
docker compose build api
```

### 3. Start MySQL

```bash
docker compose up -d mysql
```

### 4. Start the API

```bash
docker compose up -d api
```

Before the API process starts, the container automatically applies the idempotent database migration, seeds roles and default permission grants, imports the prepared `locations.json` city → zone → area catalog, and ensures the pricing matrix exists. Existing location and pricing records are preserved, so container restarts do not overwrite changes made by administrators. The container exits instead of starting the API if any setup step fails.

The location importer accepts an optional `service_type` (`ISD`, `SUBURB`, or `OSD`) on each city. When it is omitted, Dhaka defaults to `ISD` and every other city defaults to `OSD`. Add `service_type: "SUBURB"` to any prepared city that should use suburb pricing.

The API is available at:

- API: <http://localhost:8005>
- Liveness: <http://localhost:8005/health>
- Readiness: <http://localhost:8005/health/ready>
- OpenAPI: <http://localhost:8005/openapi.json>
- Swagger UI: <http://localhost:8005/docs>

Use Swagger UI or `POST /api/v1/admin/bootstrap` with `BOOTSTRAP_TOKEN` to create the first administrator.

### Operations

View service status and logs:

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f mysql
```

Rebuild and restart the API after a code change:

```bash
docker compose up -d --build api
```

Stop the deployment without deleting MySQL data:

```bash
docker compose down
```

To also delete the MySQL volume and all database data, run `docker compose down --volumes`. This is destructive and cannot be undone without a backup.
