import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { ListParams } from "../../db/models"
import {
  escapeLike,
  orderByClauseOf,
  pageOf,
  sortColumnOf,
  toDecimal,
  toUtcDate,
  whereClause,
} from "../../db/sql"

import type { RiderApplicationInput } from "./rider-applications.dto"

export type RiderApplication = {
  id: string
  name: string
  phone: string
  email: string | null
  district: string
  vehicleType: RiderApplicationInput["vehicleType"]
  licenseNumber: string | null
  experienceYears: number | null
  availability: string
  notes: string | null
  status: "PENDING" | "REVIEWING" | "APPROVED" | "REJECTED"
  createdAt: string
  updatedAt: string
}

const COLUMNS = `id, name, phone, email, district, vehicle_type, license_number,
  experience_years, availability, notes, status, created_at, updated_at`
const SORT_COLUMNS = ["created_at", "name", "district", "status"] as const

function applicationRow(row: Record<string, unknown>): RiderApplication {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: String(row.phone),
    email: row.email === null ? null : String(row.email),
    district: String(row.district),
    vehicleType: row.vehicle_type as RiderApplication["vehicleType"],
    licenseNumber: row.license_number === null ? null : String(row.license_number),
    experienceYears: row.experience_years === null ? null : toDecimal(row.experience_years),
    availability: String(row.availability),
    notes: row.notes === null ? null : String(row.notes),
    status: row.status as RiderApplication["status"],
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

export async function selectRiderApplications(
  db: Pool,
  params: ListParams,
  filter: { status?: RiderApplication["status"]; search?: string },
): Promise<{ nodes: RiderApplication[]; totalCount: number }> {
  const values: unknown[] = []
  const clauses: string[] = []
  if (filter.status) {
    clauses.push("status = ?")
    values.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push("(name LIKE ? OR phone LIKE ? OR email LIKE ? OR district LIKE ?)")
    values.push(like, like, like, like)
  }
  const where = whereClause(clauses)
  const sortParams = {
    ...params,
    sortBy: params.sortBy === "createdAt" ? "created_at" : params.sortBy,
  }
  const orderBy = orderByClauseOf(
    sortColumnOf(sortParams, SORT_COLUMNS),
    params.sort,
    "created_at DESC, id DESC",
  )
  return pageOf(db, {
    pageSql: `SELECT ${COLUMNS} FROM rider_applications ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM rider_applications${where ? ` ${where}` : ""}`,
    filterParams: values,
    params,
    decode: applicationRow,
  })
}

export async function patchRiderApplication(
  db: Pool | Connection,
  id: string,
  status: RiderApplication["status"],
): Promise<RiderApplication | null> {
  await db.execute<OkPacket>("UPDATE rider_applications SET status = ? WHERE id = ?", [status, id])
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM rider_applications WHERE id = ?`,
    [id],
  )
  return rows[0] ? applicationRow(rows[0]) : null
}

export async function selectRiderApplication(
  db: Pool | Connection,
  id: string,
  forUpdate = false,
): Promise<RiderApplication | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM rider_applications WHERE id = ?${forUpdate ? " FOR UPDATE" : ""}`,
    [id],
  )
  return rows[0] ? applicationRow(rows[0]) : null
}

export async function insertRiderApplication(
  db: Pool,
  input: RiderApplicationInput,
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO rider_applications
      (name, phone, email, district, vehicle_type, license_number, experience_years, availability, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.phone,
      input.email || null,
      input.district,
      input.vehicleType,
      input.licenseNumber || null,
      input.experienceYears ?? null,
      input.availability,
      input.notes || null,
    ],
  )
  if (!result.insertId) throw new Error("Rider application insert returned no id")
  return String(result.insertId)
}
