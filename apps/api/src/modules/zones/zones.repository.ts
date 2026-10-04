import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"
import type { ListParams, Zone } from "@/db/models"
import { buildAssignments } from "@/db/updates"

const ZONE_COLUMNS = `
  z.id, z.name, z.code, z.description, z.status, z.created_at, z.updated_at
`

const ZONE_SORT_COLUMNS = ["z.name", "z.code", "z.status", "z.created_at"] as const

const ZONE_PATCH_COLUMNS = {
  name: "name",
  code: "code",
  description: "description",
  status: "status",
} as const

function zoneRow(row: Record<string, unknown>): Zone {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    description: toStringOrNull(row.description),
    status: row.status as Zone["status"],
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  }
}

function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
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

export type ListZonesFilter = {
  status?: Zone["status"] | undefined
  search?: string | undefined
}

export async function selectZones(
  db: Pool,
  params: ListParams,
  filter: ListZonesFilter,
): Promise<{ nodes: Zone[]; totalCount: number }> {
  const paramsAcc = []
  const clauses: string[] = []

  if (filter.status) {
    clauses.push("z.status = ?")
    paramsAcc.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(
      `(${["z.name", "z.code", "z.description"].map((c) => `${c} LIKE ?`).join(" OR ")})`,
    )
    paramsAcc.push(like, like, like)
  }
  const where = clauses.length ? `WHERE (${clauses.join(") AND (")})` : ""

  const countSql = `SELECT COUNT(*) AS count FROM zones AS z${where ? " " + where : ""}`
  const sortColumn =
    params.sortBy && (ZONE_SORT_COLUMNS as readonly string[]).includes(params.sortBy)
      ? params.sortBy
      : undefined
  const orderByClause = sortColumn
    ? `${sortColumn} ${params.sort.toUpperCase()}, z.name ASC, z.id ASC`
    : `z.name ASC, z.id ASC`

  const pageSql = `SELECT ${ZONE_COLUMNS} FROM zones AS z ${where} ORDER BY ${orderByClause} LIMIT ? OFFSET ?`
  const pageParams = [...paramsAcc, params.limit, params.offset]

  return pageOf(db, pageSql, pageParams, countSql, paramsAcc, zoneRow)
}

export async function selectZone(db: Pool, zoneId: string): Promise<Zone | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${ZONE_COLUMNS} FROM zones AS z WHERE z.id = ?`,
    [zoneId],
  )
  return rows[0] ? zoneRow(rows[0]) : null
}

export async function insertZone(
  db: Pool,
  record: Omit<Zone, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const params = [record.name, record.code, record.description, record.status]
  const sql = `INSERT INTO zones (name, code, description, status) VALUES (?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, params)
  if (!result.insertId) throw new Error("Zone insert returned no id")
  return String(result.insertId)
}

export async function patchZone(
  db: Pool,
  zoneId: string,
  patch: Partial<Omit<Zone, "id" | "createdAt" | "updatedAt">>,
): Promise<Zone | null> {
  const { assignments, params } = buildAssignments(patch, ZONE_PATCH_COLUMNS)

  if (assignments.length === 0) return selectZone(db, zoneId)

  const sql = `UPDATE zones SET ${assignments.join(", ")} WHERE id = ?`
  params.push(zoneId)

  await db.execute<OkPacket>(sql, params)
  return selectZone(db, zoneId)
}
