import { randomUUID } from "node:crypto"
import type { AppEnv } from "../../types/env"
import { createMiddleware } from "hono/factory"
import { pool } from "../../db/pool"
import { createRedisShortcut } from "../context/redis"
import { getRedisClient } from "../redis/client"

// Process-wide handles bound once at module load, then attached to every request.
const redisClient = await getRedisClient()

/**
 * Single source of request context.
 *
 * This middleware sets everything a request needs: the correlation id, start
 * time, and the process-wide Redis/db handles so handlers use `c.redis.*` and
 * `c.db.*` — no other middleware or file touches `c.set`. Logging happens here
 * so every request gets a uniform log line.
 */
export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = c.req.header("X-Request-Id") ?? randomUUID()
  const startedAt = performance.now()

  c.set("requestId", requestId)
  c.set("startedAt", startedAt)
  c.set("redis", createRedisShortcut(redisClient))
  c.set("db", pool)

  c.header("X-Request-Id", requestId)

  try {
    await next()
  } finally {
    console.info("[request]", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - startedAt),
      ...(c.get("operationId") ? { operationId: c.get("operationId") } : {}),
    })
  }
})

/** Graceful shutdown helper for index.ts — closes the MySQL pool. */
export { pool as databasePool } from "../../db/pool"
