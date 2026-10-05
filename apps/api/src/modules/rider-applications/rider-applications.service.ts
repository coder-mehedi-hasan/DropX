import bcrypt from "bcryptjs"
import type { RowDataPacket, OkPacket } from "mysql2/promise"
import type { Context } from "hono"

import { buildPage, normalizeListParams, TABLES, type Page } from "../../db/models"
import { DomainError, ERROR_CODES, fromDatabaseError, notFound } from "../../core"
import { withTransaction } from "../../db/transaction"
import type { AppEnv } from "../../types/env"

import type { RiderApplication } from "./rider-applications.repository"
import { insertRider, selectRider } from "../riders/riders.repository"
import {
  patchRiderApplication,
  selectRiderApplication,
  selectRiderApplications,
} from "./rider-applications.repository"
import type { ApproveRiderApplicationInput } from "./rider-applications.dto"

export async function listRiderApplications(
  c: Context<AppEnv>,
  query: {
    page?: number
    limit?: number
    sortBy?: string
    sort?: "asc" | "desc"
    status?: string
    search?: string
  },
): Promise<Page<RiderApplication>> {
  const params = normalizeListParams(query)
  const result = await selectRiderApplications(c.get("db")!, params, {
    status: query.status as RiderApplication["status"] | undefined,
    search: query.search,
  })
  return buildPage(result.nodes, result.totalCount, params)
}

export async function updateRiderApplication(
  c: Context<AppEnv>,
  id: string,
  status: RiderApplication["status"],
): Promise<RiderApplication> {
  if (status === "APPROVED") {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      "Use the approve action to create the rider account",
    )
  }
  const application = await patchRiderApplication(c.get("db")!, id, status)
  if (!application) throw notFound("No such rider application")
  return application
}

export async function approveRiderApplication(
  c: Context<AppEnv>,
  id: string,
  input: ApproveRiderApplicationInput,
): Promise<{ application: RiderApplication; riderId: string }> {
  const db = c.get("db")!
  const passwordHash = await bcrypt.hash(input.password, 10)

  const riderId = await withTransaction(db, async (tx) => {
    const application = await selectRiderApplication(tx, id, true)
    if (!application) throw notFound("No such rider application")
    if (application.status === "APPROVED") {
      throw new DomainError(
        ERROR_CODES.ALREADY_EXISTS,
        "This application has already created a rider",
      )
    }

    const email = input.email || application.email
    if (!email) {
      throw new DomainError(
        ERROR_CODES.VALIDATION_FAILED,
        "A login email is required to create the rider",
        {
          details: [{ field: "email", message: "Add an email for the rider login" }],
        },
      )
    }

    const [taken] = await tx.query<RowDataPacket[]>(
      `SELECT id FROM ${TABLES.users} WHERE email = ? LIMIT 1`,
      [email],
    )
    if (taken[0]) {
      throw new DomainError(
        ERROR_CODES.ALREADY_EXISTS,
        "An account with that email already exists",
        {
          details: [{ field: "email", message: "Use a different login email" }],
        },
      )
    }

    let userId: string
    try {
      const [result] = await tx.execute<OkPacket>(
        `INSERT INTO ${TABLES.users} (name, email, phone, password_hash, must_change_password, status) VALUES (?, ?, ?, ?, TRUE, 'ACTIVE')`,
        [application.name, email, application.phone, passwordHash],
      )
      if (!result.insertId) throw new Error("Failed to insert rider account")
      userId = String(result.insertId)
    } catch (error) {
      throw fromDatabaseError(error, "An account with that email already exists")
    }

    try {
      const createdRiderId = await insertRider(tx, {
        userId,
        hubId: input.hubId,
        employeeCode: input.employeeCode,
        licenseNumber: input.licenseNumber || application.licenseNumber,
        compensationType: input.compensationType,
        status: "OFFLINE",
      })
      await tx.execute<OkPacket>("UPDATE rider_applications SET status = 'APPROVED' WHERE id = ?", [
        id,
      ])
      return createdRiderId
    } catch (error) {
      throw fromDatabaseError(error, "A rider with that employee code already exists")
    }
  })

  const application = await selectRiderApplication(db, id)
  const rider = await selectRider(db, riderId)
  if (!application || !rider)
    throw new Error("Approved rider disappeared immediately after creation")
  return { application, riderId }
}
