import type { Logger } from "../core/logger"
import type { AuthContext } from "../shared/auth/auth-context"

/**
 * The per-request context Hono carries.
 *
 * Everything a handler needs is on `c.get(...)` and is populated by middleware,
 * so handlers never re-parse headers. Infrastructure is the exception: the
 * database handle and the cache are process-wide, so a service resolves them
 * itself instead of the transport passing an identity copy down per request.
 */
export type AppVariables = {
  logger: Logger
  /** Correlation id — echoed as `X-Request-Id` and attached to every log line. */
  requestId: string
  auth: AuthContext
  /** `process.hrtime` at request entry, for the duration log. */
  startedAt: number
  /** Operation id from the policy catalog, for audit logging. */
  operationId: string
}

export type AppEnv = {
  Variables: AppVariables
}
