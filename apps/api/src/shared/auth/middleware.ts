import { getDatabase } from "@dropx/db"

import { ERROR_CODES, DomainError } from "../../core/errors"
import type { AuthContext, Audience } from "./auth-context"
import { loadCustomerActor, loadRiderActor, loadStaffActor } from "./actor-loader"
import { verifyToken } from "./actor-loader"
import { PERMISSIONS } from "./permissions"
import type { AppEnv } from "../../types/env"
import type { Context } from "hono"
import { createMiddleware } from "hono/factory"

/**
 * Populates `c.get("auth")` from the `Authorization` header.
 *
 * A request with no token gets a `public` actor rather than a rejection — the
 * policy layer decides whether public is allowed. Invalid *present* tokens fail
 * here, so a stale session never silently downgrades to anonymous.
 */
export const attachAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization")

  if (!header?.startsWith("Bearer ")) {
    c.set("auth", { audience: "admin", actor: { kind: "public" }, sessionId: "" })
    return next()
  }

  const token = header.slice("Bearer ".length).trim()
  const payload = await verifyToken(token, "access")
  const audience = payload.aud

  let actor: AuthContext["actor"]

  if (audience === "web") {
    actor = await loadCustomerActor(getDatabase(), payload.sub)
  } else {
    const db = getDatabase()
    const staff = await loadStaffActor(db, payload.sub)
    if (staff) {
      actor = staff
    } else {
      const rider = await loadRiderActor(db, payload.sub)
      if (!rider) {
        throw new DomainError(
          ERROR_CODES.TOKEN_INVALID,
          "This account is not provisioned for this app",
        )
      }
      actor = rider
    }
  }

  c.set("auth", { audience, actor, sessionId: payload.sid })
  return next()
})

/**
 * Fails closed when the actor lacks any of `required`.
 *
 * Callers pass every key the operation needs; any-of semantics, so a route
 * guarded by two alternatives grants on either.
 */
export function assertPermissions(c: Context<AppEnv>, required: readonly string[]): void {
  if (required.length === 0) return

  const { actor } = c.get("auth")
  const granted =
    actor.kind === "staff" || actor.kind === "rider" ? actor.permissions : new Set<string>()

  const missing = required.filter((key) => !granted.has(key))
  if (missing.length === 0) return

  throw new DomainError(
    ERROR_CODES.MISSING_PERMISSION,
    "You do not have permission to perform this action",
    { details: missing.map((message) => ({ field: "permission", message })) },
  )
}

export function assertAudience(c: Context<AppEnv>, allowed: readonly Audience[]): void {
  if (allowed.length === 0) return
  const { audience } = c.get("auth")
  if (!allowed.includes(audience)) {
    throw new DomainError(ERROR_CODES.WRONG_AUDIENCE, "This endpoint is not available for this app")
  }
}

/** Customers must have completed OTP verification before using the portal. */
export function assertActiveCustomer(c: Context<AppEnv>): void {
  const { actor } = c.get("auth")
  if (actor.kind !== "customer") return
  if (actor.status !== "ACTIVE") {
    throw new DomainError(
      ERROR_CODES.CUSTOMER_NOT_ACTIVE,
      "Please verify your phone number to continue",
    )
  }
}

export { PERMISSIONS }
