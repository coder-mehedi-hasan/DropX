import type { Pool, RowDataPacket } from "mysql2/promise"
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

export async function loadStaffActor(db: Pool, userId: string): Promise<StaffAuth | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, branch_id, email, status FROM users WHERE id = ? LIMIT 1`,
    [userId],
  )
  const user = rows[0]

  if (!user) return null

  if (user.status !== "ACTIVE") {
    throw new DomainError(
      user.status === "SUSPENDED" ? ERROR_CODES.FORBIDDEN : ERROR_CODES.INVALID_CREDENTIALS,
      user.status === "SUSPENDED" ? "This account has been suspended" : "This account is inactive",
    )
  }

  const [roles, permissions, hubs] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT r.name
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ?`,
      [userId],
    ).then(([rows]) => rows),
    db.query<RowDataPacket[]>(
      `SELECT DISTINCT rp.permission_key
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
        WHERE ur.user_id = ?`,
      [userId],
    ).then(([rows]) => rows),
    db.query<RowDataPacket[]>(`SELECT hub_id FROM user_hubs WHERE user_id = ?`, [userId]).then(
      ([rows]) => rows,
    ),
  ])

  return {
    kind: "staff",
    userId: String(user.id),
    email: user.email,
    roles: roles.map((row) => row.name),
    permissions: new Set(permissions.map((row) => row.permission_key)),
    branchId: user.branch_id === null ? null : String(user.branch_id),
    hubIds: hubs.map((row) => String(row.hub_id)),
  }
}

export async function loadRiderActor(db: Pool, userId: string): Promise<RiderAuth | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT r.id, r.hub_id, r.status AS rider_status,
            u.email, u.branch_id, u.status AS user_status
       FROM riders r
       JOIN users u ON u.id = r.user_id
      WHERE r.user_id = ?
      LIMIT 1`,
    [userId],
  )
  const row = rows[0]

  if (!row) return null

  if (row.user_status !== "ACTIVE" || row.rider_status === "SUSPENDED") {
    throw new DomainError(ERROR_CODES.FORBIDDEN, "This rider account is not active")
  }

  const [permissions] = await db.query<RowDataPacket[]>(
    `SELECT DISTINCT rp.permission_key
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?`,
    [userId],
  )

  return {
    kind: "rider",
    userId: String(userId),
    riderId: String(row.id),
    hubId: String(row.hub_id),
    email: row.email,
    roles: ["RIDER"],
    permissions: new Set(permissions.map((entry) => entry.permission_key)),
    branchId: row.branch_id === null ? null : String(row.branch_id),
  }
}

export async function loadCustomerActor(db: Pool, customerId: string): Promise<CustomerAuth> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT status FROM customers WHERE id = ? LIMIT 1`,
    [customerId],
  )
  const customer = rows[0]

  if (!customer) {
    throw new DomainError(ERROR_CODES.TOKEN_INVALID, "This account no longer exists")
  }

  return { kind: "customer", customerId: String(customerId), status: customer.status }
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
