import { TABLES, toId, type Id } from "@dropx/db"
import type { Database } from "@dropx/db"
import { verify } from "hono/jwt"

import { getConfig } from "../../config"
import { ERROR_CODES, DomainError } from "../../core/errors"
import type { Audience, CustomerAuth, RiderAuth, StaffAuth } from "./auth-context"
import { JWT_ALGORITHM, type TokenPayload, type TokenType } from "./tokens"

/**
 * Loads the actor behind a token.
 *
 * Identity always comes from a verified token, never from client input, and
 * roles/permissions/status are read fresh on every request — so a suspended
 * user or a revoked role loses access immediately rather than at token expiry.
 */

export async function loadStaffActor(db: Database, userId: Id): Promise<StaffAuth | null> {
  const user = await db.queryOne<{
    id: string
    branch_id: string | null
    email: string
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
  }>(`SELECT id, branch_id, email, status FROM ${TABLES.users} WHERE id = ? LIMIT 1`, [userId])

  if (!user) return null

  if (user.status !== "ACTIVE") {
    throw new DomainError(
      user.status === "SUSPENDED" ? ERROR_CODES.FORBIDDEN : ERROR_CODES.INVALID_CREDENTIALS,
      user.status === "SUSPENDED" ? "This account has been suspended" : "This account is inactive",
    )
  }

  const [roles, permissions, hubs] = await Promise.all([
    db.query<{ name: string }>(
      `SELECT r.name
         FROM ${TABLES.userRoles} ur
         JOIN ${TABLES.roles} r ON r.id = ur.role_id
        WHERE ur.user_id = ?`,
      [userId],
    ),
    db.query<{ permission_key: string }>(
      `SELECT DISTINCT rp.permission_key
         FROM ${TABLES.userRoles} ur
         JOIN ${TABLES.rolePermissions} rp ON rp.role_id = ur.role_id
        WHERE ur.user_id = ?`,
      [userId],
    ),
    db.query<{ hub_id: string }>(`SELECT hub_id FROM ${TABLES.userHubs} WHERE user_id = ?`, [
      userId,
    ]),
  ])

  return {
    kind: "staff",
    userId: toId(user.id),
    email: user.email,
    roles: roles.rows.map((row) => row.name),
    permissions: new Set(permissions.rows.map((row) => row.permission_key)),
    branchId: user.branch_id === null ? null : toId(user.branch_id, "branchId"),
    hubIds: hubs.rows.map((row) => toId(row.hub_id, "hubId")),
  }
}

export async function loadRiderActor(db: Database, userId: Id): Promise<RiderAuth | null> {
  const row = await db.queryOne<{
    id: string
    hub_id: string
    email: string
    branch_id: string | null
    user_status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
    rider_status: "AVAILABLE" | "BUSY" | "OFFLINE" | "SUSPENDED"
  }>(
    `SELECT r.id, r.hub_id, r.status AS rider_status,
            u.email, u.branch_id, u.status AS user_status
       FROM ${TABLES.riders} r
       JOIN ${TABLES.users} u ON u.id = r.user_id
      WHERE r.user_id = ?
      LIMIT 1`,
    [userId],
  )

  if (!row) return null

  if (row.user_status !== "ACTIVE" || row.rider_status === "SUSPENDED") {
    throw new DomainError(ERROR_CODES.FORBIDDEN, "This rider account is not active")
  }

  const permissions = await db.query<{ permission_key: string }>(
    `SELECT DISTINCT rp.permission_key
       FROM ${TABLES.userRoles} ur
       JOIN ${TABLES.rolePermissions} rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?`,
    [userId],
  )

  return {
    kind: "rider",
    userId: toId(userId, "userId"),
    riderId: toId(row.id, "riderId"),
    hubId: toId(row.hub_id, "hubId"),
    email: row.email,
    roles: ["RIDER"],
    permissions: new Set(permissions.rows.map((entry) => entry.permission_key)),
    branchId: row.branch_id === null ? null : toId(row.branch_id, "branchId"),
  }
}

export async function loadCustomerActor(db: Database, customerId: Id): Promise<CustomerAuth> {
  const customer = await db.queryOne<{ status: "TEMP" | "ACTIVE" }>(
    `SELECT status FROM ${TABLES.customers} WHERE id = ? LIMIT 1`,
    [customerId],
  )

  if (!customer) {
    throw new DomainError(ERROR_CODES.TOKEN_INVALID, "This account no longer exists")
  }

  return { kind: "customer", customerId: toId(customerId, "customerId"), status: customer.status }
}

export async function verifyToken(
  token: string,
  expectedType: TokenType,
  expectedAudience?: Audience,
): Promise<TokenPayload> {
  const { auth } = getConfig()

  let payload: TokenPayload
  try {
    payload = (await verify(token, auth.secret, JWT_ALGORITHM)) as TokenPayload
  } catch (error) {
    const expired = error instanceof Error && /expired/i.test(error.message)
    throw new DomainError(
      expired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.TOKEN_INVALID,
      expired ? "Your session has expired" : "Your session is not valid",
      { cause: error },
    )
  }

  if (payload.typ !== expectedType) {
    throw new DomainError(ERROR_CODES.TOKEN_INVALID, "Wrong token type for this operation")
  }

  if (expectedAudience && payload.aud !== expectedAudience) {
    throw new DomainError(ERROR_CODES.WRONG_AUDIENCE, "This session belongs to a different app")
  }

  if (!auth.audiences.includes(payload.aud)) {
    throw new DomainError(ERROR_CODES.TOKEN_INVALID, "Unknown token audience")
  }

  return payload
}
