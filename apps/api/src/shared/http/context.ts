import { getConfig } from "../../config"
import { createLogger, newCorrelationId } from "../../core/logger"
import type { AppEnv } from "../../types/env"
import { createMiddleware } from "hono/factory"

/**
 * Per-request context: correlation id, logger, start time.
 *
 * No database handle here on purpose — the pool is process-wide, so putting it
 * on the context would only spread an identity copy of `getDatabase()`.
 */
export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = c.req.header("X-Request-Id") ?? newCorrelationId()
  const startedAt = performance.now()

  c.set("requestId", requestId)
  c.set("startedAt", startedAt)
  // Logger first: everything below can throw, and both the `finally` block and
  // `onError` depend on it being present.
  c.set("logger", createLogger(getConfig().logLevel, { requestId }))

  c.header("X-Request-Id", requestId)

  try {
    await next()
  } finally {
    c.get("logger").info("request", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - startedAt),
      ...(c.get("operationId") ? { operationId: c.get("operationId") } : {}),
    })
  }
})
