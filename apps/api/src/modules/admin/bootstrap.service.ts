import { timingSafeEqual } from "node:crypto"

import bcrypt from "bcryptjs"

import { getConfig } from "../../config/env"
import { DomainError, ERROR_CODES } from "../../core"
import { TABLES } from "../../db/models"
import { toUtcDate } from "../../db/sql"
import { withTransaction } from "../../db/transaction"
import type { BootstrapAdminInput } from "./bootstrap.dto"

import type { OkPacket, RowDataPacket } from "mysql2/promise"
import type { Context } from "hono"
import type { AppEnv } from "../../types/env"

/**
 * Creating the first administrator, over HTTP.
 *
 * This replaces `scripts/bootstrap-admin.ts`, which needed shell access and so was
 * safe by accident. A route does not get that accident, so the safety moves into
 * the code: two independent locks, and the route is only ever open during the one
 * moment it exists to be used.
 *
 * 1. **A shared token.** `BOOTSTRAP_TOKEN` must be configured and must match. An
 *    unset token refuses every request rather than allowing every request, so a
 *    deploy that forgot it is closed.
 * 2. **One-shot.** Refuses once any account holds the ADMIN role. This is the real
 *    boundary: it is what stops the route being a permanent unauthenticated way to
 *    mint an admin, and unlike the token it does not depend on a secret staying
 *    secret.
 *
 * The one-shot test runs *inside* the transaction and takes a row lock on the
 * ADMIN role, so two simultaneous requests cannot both observe "no admin yet" and
 * both insert. The second waits for the first to commit, then sees the admin and is
 * refused. Testing outside the transaction would leave that race wide open.
 */

const ROLE = "ADMIN"

type RoleRow = RowDataPacket & { id: string }
type CountRow = RowDataPacket & { total: number }
type UserRow = RowDataPacket & {
  id: string
  name: string
  email: string
  status: string
  created_at: string | Date
}

export interface BootstrappedAdmin {
  id: string
  name: string
  email: string
  status: string
  createdAt: string
}

/** Length-independent comparison, so a wrong token cannot be found one byte at a time. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // `timingSafeEqual` throws on a length mismatch, and that throw would itself leak
  // the length, so the lengths are compared separately and the throw is never reached.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function bootstrapAdmin(
  c: Context<AppEnv>,
  input: BootstrapAdminInput,
): Promise<BootstrappedAdmin> {
  const db = c.get("db")!
  const { token: expected } = getConfig().bootstrap

  if (!expected) {
    throw new DomainError(
      ERROR_CODES.FORBIDDEN,
      "Bootstrap is not enabled on this server. Set BOOTSTRAP_TOKEN to turn it on.",
    )
  }

  if (!tokenMatches(input.token, expected)) {
    throw new DomainError(ERROR_CODES.UNAUTHENTICATED, "Invalid bootstrap token")
  }

  // Outside the transaction only as a fast, clearer pre-check. A role that was never
  // seeded is a setup problem rather than a conflict, so it is reported as one.
  const [seeded] = await db.query<RoleRow[]>(
    `SELECT id FROM ${TABLES.roles} WHERE name = ? LIMIT 1`,
    [ROLE],
  )
  if (!seeded[0]) {
    throw new DomainError(
      ERROR_CODES.IN_USE,
      "No roles in the database. Run the seed, then bootstrap again.",
    )
  }

  // bcrypt before the transaction: it is deliberately slow, and holding a connection
  // open across it would needlessly narrow the pool.
  const passwordHash = await bcrypt.hash(input.password, 10)

  const userId = await withTransaction(db, async (tx) => {
    // Serialises concurrent bootstraps — both transactions queue on this one row, so
    // the second cannot reach the count check until the first has committed.
    const [locked] = await tx.query<RoleRow[]>(
      `SELECT id FROM ${TABLES.roles} WHERE name = ? FOR UPDATE`,
      [ROLE],
    )
    const role = locked[0]
    /* c8 ignore next 3 -- the row was read above; taking the lock cannot lose it. */
    if (!role) {
      throw new DomainError(ERROR_CODES.IN_USE, "The ADMIN role disappeared mid-request")
    }

    const [admins] = await tx.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM ${TABLES.userRoles} WHERE role_id = ?`,
      [role.id],
    )
    if (Number(admins[0]?.total ?? 0) > 0) {
      throw new DomainError(
        ERROR_CODES.ALREADY_EXISTS,
        "An administrator already exists. Sign in instead, or add staff from the admin app.",
      )
    }

    const [taken] = await tx.query<RowDataPacket[]>(
      `SELECT id FROM ${TABLES.users} WHERE email = ? LIMIT 1`,
      [input.email],
    )
    if (taken[0]) {
      throw new DomainError(ERROR_CODES.DUPLICATE, "An account with that email already exists.")
    }

    const [result] = await tx.execute<OkPacket>(
      `INSERT INTO ${TABLES.users} (name, email, password_hash, status)
       VALUES (?, ?, ?, 'ACTIVE')`,
      [input.name, input.email, passwordHash],
    )
    if (!result.insertId) throw new Error("Failed to insert the admin user")

    await tx.execute(`INSERT INTO ${TABLES.userRoles} (user_id, role_id) VALUES (?, ?)`, [
      String(result.insertId),
      role.id,
    ])

    return String(result.insertId)
  })

  const [rows] = await db.query<UserRow[]>(
    `SELECT id, name, email, status, created_at FROM ${TABLES.users} WHERE id = ?`,
    [userId],
  )
  const user = rows[0]
  /* c8 ignore next -- the row was just inserted by the transaction above. */
  if (!user) throw new Error("The admin user vanished immediately after creation")

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    createdAt: toUtcDate(user.created_at).toISOString(),
  }
}
