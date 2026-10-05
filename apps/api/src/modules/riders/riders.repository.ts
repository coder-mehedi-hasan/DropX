import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"
import type { ListParams, Rider } from "@/db/models"
import { escapeLike, orderByClauseOf, pageOf, sortColumnOf, toUtcDate, whereClause } from "@/db/sql"
import { buildAssignments } from "@/db/updates"

const RIDER_COLUMNS = `
  r.id, r.user_id, r.hub_id, r.employee_code, r.license_number,
  r.compensation_type, r.status, r.created_at, r.updated_at
`

const RIDER_SORT_COLUMNS = ["r.employee_code", "r.status", "r.hub_id", "r.created_at"] as const
const RIDER_TIEBREAK = "r.employee_code ASC, r.id ASC"
/** Name and email live on `users`; the rider's own columns have no free text. */
const RIDER_SEARCH_COLUMNS = ["u.name", "u.email", "r.employee_code"]

const RIDER_PATCH_COLUMNS = {
  hubId: "hub_id",
  employeeCode: "employee_code",
  licenseNumber: "license_number",
  compensationType: "compensation_type",
  status: "status",
} as const

/** The join is needed on every read, so `users` is always aliased in FROM. */
const RIDER_FROM = "riders AS r INNER JOIN users AS u ON u.id = r.user_id"

function riderRow(row: Record<string, unknown>): Rider {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    hubId: String(row.hub_id),
    employeeCode: String(row.employee_code),
    licenseNumber: row.license_number === null ? null : String(row.license_number),
    compensationType: row.compensation_type as Rider["compensationType"],
    status: row.status as Rider["status"],
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

export type ListRidersFilter = {
  status?: Rider["status"] | undefined
  compensationType?: Rider["compensationType"] | undefined
  hubId?: string | undefined
  search?: string | undefined
}

export async function selectRiders(
  db: Pool,
  params: ListParams,
  filter: ListRidersFilter,
): Promise<{ nodes: Rider[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.status) {
    clauses.push("r.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.compensationType) {
    clauses.push("r.compensation_type = ?")
    filterParams.push(filter.compensationType)
  }
  if (filter.hubId) {
    clauses.push("r.hub_id = ?")
    filterParams.push(filter.hubId)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${RIDER_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of RIDER_SEARCH_COLUMNS) filterParams.push(like)
  }

  const where = whereClause(clauses)
  const orderBy = orderByClauseOf(
    sortColumnOf(params, RIDER_SORT_COLUMNS),
    params.sort,
    RIDER_TIEBREAK,
  )

  return pageOf(db, {
    pageSql: `SELECT ${RIDER_COLUMNS} FROM ${RIDER_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM ${RIDER_FROM}${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: riderRow,
  })
}

export async function selectRider(db: Pool | Connection, riderId: string): Promise<Rider | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${RIDER_COLUMNS} FROM ${RIDER_FROM} WHERE r.id = ?`,
    [riderId],
  )
  return rows[0] ? riderRow(rows[0]) : null
}

/**
 * A `riders` row is meaningless without its `users` row (rule 8: one user, one
 * rider), so existence is checked across both in one lookup rather than trusting
 * a bare insert to have succeeded.
 */
export async function selectRiderByUserId(
  db: Pool | Connection,
  userId: string,
): Promise<Rider | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${RIDER_COLUMNS} FROM ${RIDER_FROM} WHERE r.user_id = ?`,
    [userId],
  )
  return rows[0] ? riderRow(rows[0]) : null
}

export async function insertRider(
  db: Pool | Connection,
  record: Omit<Rider, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const sql = `INSERT INTO riders (user_id, hub_id, employee_code, license_number, compensation_type, status) VALUES (?, ?, ?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, [
    record.userId,
    record.hubId,
    record.employeeCode,
    record.licenseNumber,
    record.compensationType,
    record.status,
  ])
  if (!result.insertId) throw new Error("Rider insert returned no id")
  return String(result.insertId)
}

export async function patchRider(
  db: Pool | Connection,
  riderId: string,
  patch: Partial<Omit<Rider, "id" | "userId" | "createdAt" | "updatedAt">>,
): Promise<Rider | null> {
  const { assignments, params } = buildAssignments(patch, RIDER_PATCH_COLUMNS)

  if (assignments.length === 0) return selectRider(db, riderId)

  const sql = `UPDATE riders SET ${assignments.join(", ")} WHERE id = ?`
  params.push(riderId)

  await db.execute<OkPacket>(sql, params)
  return selectRider(db, riderId)
}
