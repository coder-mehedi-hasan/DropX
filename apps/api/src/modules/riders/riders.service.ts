import bcrypt from "bcryptjs"

import type { OkPacket, RowDataPacket } from "mysql2/promise"

import { DomainError, ERROR_CODES, fromDatabaseError, notFound } from "../../core"
import type { Context } from "hono"
import type { Rider } from "../../db/models"
import { buildPage, normalizeListParams, TABLES, type Page } from "../../db/models"
import { withTransaction } from "../../db/transaction"
import type { AppEnv } from "../../types/env"

import type { CreateRiderInput, ListRidersQuery, UpdateRiderInput } from "./riders.dto"

import {
  insertRider,
  patchRider,
  selectRider,
  selectRiderByUserId,
  selectRiders,
} from "./riders.repository"

export async function listRiders(c: Context<AppEnv>, query: ListRidersQuery): Promise<Page<Rider>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectRiders(c.get("db")!, params, {
    status: query.status,
    compensationType: query.compensationType,
    hubId: query.hubId,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getRider(c: Context<AppEnv>, riderId: string): Promise<Rider> {
  const rider = await selectRider(c.get("db")!, riderId)
  if (!rider) throw notFound("No such rider")
  return rider
}

/**
 * Creating a rider writes two tables, because a rider is a `users` row plus a
 * `riders` row (rule 8) and the rider app signs in with the account half. Both go
 * in one transaction: a rider row with no account, or an account with no rider
 * row, is a rider who can never be scheduled or can never sign in.
 */
export async function createRider(c: Context<AppEnv>, input: CreateRiderInput): Promise<Rider> {
  const db = c.get("db")!
  const password = typeof input.password === "string" ? input.password : undefined
  if (!password) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "A password is required to create a rider")
  }

  // Deliberately slow; hashed outside the transaction so the pooled connection
  // is not held across it.
  const passwordHash = await bcrypt.hash(password, 10)

  const riderId = await withTransaction(db, async (tx) => {
    const [taken] = await tx.query<RowDataPacket[]>(
      `SELECT id FROM ${TABLES.users} WHERE email = ? LIMIT 1`,
      [input.email],
    )
    if (taken[0]) {
      throw new DomainError(
        ERROR_CODES.ALREADY_EXISTS,
        "An account with that email already exists. Riders sign in with an email, so it must be unique.",
      )
    }

    let userId: string
    try {
      const [result] = await tx.execute<OkPacket>(
        `INSERT INTO ${TABLES.users} (name, email, phone, password_hash, must_change_password, status)
         VALUES (?, ?, ?, ?, TRUE, 'ACTIVE')`,
        [input.name, input.email, input.phone ?? null, passwordHash],
      )
      if (!result.insertId) throw new Error("Failed to insert the rider account")
      userId = String(result.insertId)
    } catch (error) {
      throw fromDatabaseError(error, "An account with that email already exists")
    }

    const [riderRoles] = await tx.query<RowDataPacket[]>(
      `SELECT id FROM ${TABLES.roles} WHERE name = 'RIDER' LIMIT 1`,
    )
    const riderRole = riderRoles[0]
    if (!riderRole) {
      throw new DomainError(
        ERROR_CODES.VALIDATION_FAILED,
        "The RIDER role is not seeded. Run the database seed before creating riders.",
      )
    }

    await tx.execute(`INSERT INTO ${TABLES.userRoles} (user_id, role_id) VALUES (?, ?)`, [
      userId,
      riderRole.id,
    ])

    try {
      return await insertRider(tx, {
        userId,
        hubId: input.hubId,
        employeeCode: input.employeeCode,
        licenseNumber: input.licenseNumber ?? null,
        compensationType: input.compensationType,
        status: input.status,
      })
    } catch (error) {
      if (error instanceof DomainError) throw error
      throw fromDatabaseError(error, "A rider with that employee code already exists")
    }
  })

  const rider = await selectRider(db, riderId)
  /* c8 ignore next -- read straight back from a row the transaction just wrote. */
  if (!rider) throw new Error("The rider vanished immediately after creation")
  return rider
}

/**
 * `users` fields are deliberately not patchable here (see `updateRiderSchema`):
 * an existing rider's email or name is a user edit, so this path only touches the
 * rider's own columns.
 */
export async function updateRider(
  c: Context<AppEnv>,
  riderId: string,
  patch: UpdateRiderInput,
): Promise<Rider> {
  const db = c.get("db")!
  if (!(await selectRider(db, riderId))) throw notFound("No such rider")

  try {
    const rider = await patchRider(db, riderId, patch)
    if (!rider) throw notFound("No such rider")
    return rider
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A rider with that employee code already exists")
  }
}

/**
 * Availability is a separate operation rather than a PATCH field: it is the one
 * rider state ops flips constantly from a phone, and it has its own transition
 * rules to describe in `/docs`.
 */
export async function setRiderStatus(
  c: Context<AppEnv>,
  riderId: string,
  status: Rider["status"],
): Promise<Rider> {
  return updateRider(c, riderId, { status })
}

export { selectRiderByUserId }
