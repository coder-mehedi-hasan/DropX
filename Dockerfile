# syntax=docker/dockerfile:1

FROM oven/bun:1.3.13-alpine AS dependencies

WORKDIR /app

# Keep dependency installation cacheable. The API only imports the source-only
# @dropx/types workspace, so the frontend workspaces are not installed.
COPY package.json bun.lock ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/riders/package.json apps/riders/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN bun install --frozen-lockfile --production --filter @dropx/api

FROM oven/bun:1.3.13-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    API_PORT=8005

COPY --from=dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun locations.json ./locations.json
COPY --chown=bun:bun apps/api/package.json ./apps/api/package.json
COPY --chown=bun:bun apps/api/scripts ./apps/api/scripts
COPY --chown=bun:bun apps/api/src ./apps/api/src
COPY --chown=bun:bun packages/types ./packages/types

USER bun

EXPOSE 8005

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${API_PORT}/health" || exit 1

CMD ["sh", "-c", "bun run --cwd apps/api migrate && bun run --cwd apps/api seed && bun run --cwd apps/api seed:locations && bun run --cwd apps/api seed:pricing && exec bun run --cwd apps/api start"]
