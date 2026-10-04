import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"
import type { ListParams, Vehicle } from "@/db/models"
import {
  escapeLike,
  orderByClauseOf,
  pageOf,
  sortColumnOf,
  toDecimal,
  toUtcDate,
  whereClause,
} from "@/db/sql"
import { buildAssignments } from "@/db/updates"

const VEHICLE_COLUMNS = `
  v.id, v.registration_number, v.type, v.capacity_kg, v.status, v.created_at, v.updated_at
`

const VEHICLE_SORT_COLUMNS = [
  "v.registration_number",
  "v.type",
  "v.status",
  "v.capacity_kg",
  "v.created_at",
] as const
const VEHICLE_TIEBREAK = "v.registration_number ASC, v.id ASC"
const VEHICLE_SEARCH_COLUMNS = ["v.registration_number"]

const VEHICLE_PATCH_COLUMNS = {
  registrationNumber: "registration_number",
  type: "type",
  capacityKg: "capacity_kg",
  status: "status",
} as const

function vehicleRow(row: Record<string, unknown>): Vehicle {
  return {
    id: String(row.id),
    registrationNumber: String(row.registration_number),
    type: row.type as Vehicle["type"],
    capacityKg: toDecimal(row.capacity_kg),
    status: row.status as Vehicle["status"],
    createdAt: toUtcDate(row.created_at as string | Date),
    updatedAt: toUtcDate(row.updated_at as string | Date),
  }
}

export type ListVehiclesFilter = {
  type?: Vehicle["type"] | undefined
  status?: Vehicle["status"] | undefined
  search?: string | undefined
}

export async function selectVehicles(
  db: Pool,
  params: ListParams,
  filter: ListVehiclesFilter,
): Promise<{ nodes: Vehicle[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.type) {
    clauses.push("v.type = ?")
    filterParams.push(filter.type)
  }
  if (filter.status) {
    clauses.push("v.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${VEHICLE_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of VEHICLE_SEARCH_COLUMNS) filterParams.push(like)
  }
  const where = whereClause(clauses)
  const orderBy = orderByClauseOf(
    sortColumnOf(params, VEHICLE_SORT_COLUMNS),
    params.sort,
    VEHICLE_TIEBREAK,
  )

  return pageOf(db, {
    pageSql: `SELECT ${VEHICLE_COLUMNS} FROM vehicles AS v ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM vehicles AS v${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: vehicleRow,
  })
}

export async function selectVehicle(db: Pool, vehicleId: string): Promise<Vehicle | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${VEHICLE_COLUMNS} FROM vehicles AS v WHERE v.id = ?`,
    [vehicleId],
  )
  return rows[0] ? vehicleRow(rows[0]) : null
}

export async function insertVehicle(
  db: Pool,
  record: Omit<Vehicle, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const sql = `INSERT INTO vehicles (registration_number, type, capacity_kg, status) VALUES (?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, [
    record.registrationNumber,
    record.type,
    record.capacityKg,
    record.status,
  ])
  if (!result.insertId) throw new Error("Vehicle insert returned no id")
  return String(result.insertId)
}

export async function patchVehicle(
  db: Pool,
  vehicleId: string,
  patch: Partial<Omit<Vehicle, "id" | "createdAt" | "updatedAt">>,
): Promise<Vehicle | null> {
  const { assignments, params } = buildAssignments(patch, VEHICLE_PATCH_COLUMNS)

  if (assignments.length === 0) return selectVehicle(db, vehicleId)

  const sql = `UPDATE vehicles SET ${assignments.join(", ")} WHERE id = ?`
  params.push(vehicleId)

  await db.execute<OkPacket>(sql, params)
  return selectVehicle(db, vehicleId)
}
