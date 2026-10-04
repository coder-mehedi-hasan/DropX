import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"
import type { ListParams, Zone } from "@/db/models"
import {
  escapeLike,
  orderByClauseOf,
  pageOf,
  sortColumnOf,
  toStringOrNull,
  toUtcDate,
  whereClause,
} from "@/db/sql"
import { buildAssignments } from "@/db/updates"

const ZONE_COLUMNS = `
  z.id, z.name, z.code, z.description, z.status, z.created_at, z.updated_at
`

const ZONE_SORT_COLUMNS = ["z.name", "z.code", "z.status", "z.created_at"] as const
const ZONE_TIEBREAK = "z.name ASC, z.id ASC"
const ZONE_SEARCH_COLUMNS = ["z.name", "z.code", "z.description"]

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
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
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
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.status) {
    clauses.push("z.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${ZONE_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of ZONE_SEARCH_COLUMNS) filterParams.push(like)
  }
  const where = whereClause(clauses)
  const orderBy = orderByClauseOf(
    sortColumnOf(params, ZONE_SORT_COLUMNS),
    params.sort,
    ZONE_TIEBREAK,
  )

  return pageOf(db, {
    pageSql: `SELECT ${ZONE_COLUMNS} FROM zones AS z ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM zones AS z${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: zoneRow,
  })
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
  const sql = `INSERT INTO zones (name, code, description, status) VALUES (?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, [
    record.name,
    record.code,
    record.description,
    record.status,
  ])
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
