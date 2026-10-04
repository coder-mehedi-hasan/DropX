import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"
import type { ListParams, Vehicle } from "@/db/models"
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
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  }
}

function toDecimal(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

async function pageOf<T>(
  db: Pool,
  sql: string,
  params: unknown[],
  countSql: string,
  countParams: unknown[],
  decode: (row: Record<string, unknown>) => T,
): Promise<{ nodes: T[]; totalCount: number }> {
  const [countRows] = await db.query<RowDataPacket[]>(countSql, countParams)
  const [rows] = await db.query<RowDataPacket[]>(sql, params)
  const countRow = countRows[0]
  const totalCount = countRow?.count == null ? 0 : Number(countRow.count)
  return { nodes: rows.map(decode), totalCount }
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
  const paramsAcc = []
  const clauses: string[] = []

  if (filter.type) {
    clauses.push("v.type = ?")
    paramsAcc.push(filter.type)
  }
  if (filter.status) {
    clauses.push("v.status = ?")
    paramsAcc.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${["v.registration_number"].map((c) => `${c} LIKE ?`).join(" OR ")})`)
    paramsAcc.push(like)
  }
  const where = clauses.length ? `WHERE (${clauses.join(") AND (")})` : ""

  const countSql = `SELECT COUNT(*) AS count FROM vehicles AS v${where ? " " + where : ""}`
  const sortColumn =
    params.sortBy && (VEHICLE_SORT_COLUMNS as readonly string[]).includes(params.sortBy)
      ? params.sortBy
      : undefined
  const orderByClause = sortColumn
    ? `${sortColumn} ${params.sort.toUpperCase()}, v.registration_number ASC, v.id ASC`
    : `v.registration_number ASC, v.id ASC`

  const pageSql = `SELECT ${VEHICLE_COLUMNS} FROM vehicles AS v ${where} ORDER BY ${orderByClause} LIMIT ? OFFSET ?`
  const pageParams = [...paramsAcc, params.limit, params.offset]

  return pageOf(db, pageSql, pageParams, countSql, paramsAcc, vehicleRow)
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
  const params = [record.registrationNumber, record.type, record.capacityKg, record.status]
  const sql = `INSERT INTO vehicles (registration_number, type, capacity_kg, status) VALUES (?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, params)
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
