import type { AuthContext } from "../shared/auth/auth-context"
import type { Pool } from "mysql2/promise"
import type { RedisShortcut } from "../shared/context/redis"

/**
 * The per-request context Hono carries.
 *
 * Everything a handler needs is on `c.get(...)` and is populated by middleware,
 * so handlers never re-parse headers. Redis and the database are bound once at
 * boot and attached to every request — `c.redis.get(key)`, `c.db.query(...)`.
 */
export type AppVariables = {
  /** Correlation id — echoed as `X-Request-Id` and attached to every log line. */
  requestId: string
  auth: AuthContext
  /** `performance.now()` at request entry. */
  startedAt: number
  /** Operation id from the policy catalog, for audit logging. */
  operationId: string
  redis: RedisShortcut
  db: Pool
}

export type AppEnv = {
  Variables: AppVariables
}
