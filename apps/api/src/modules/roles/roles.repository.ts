import type { Pool, RowDataPacket } from "mysql2/promise"

import type { ListParams } from "@/db/models"
import { escapeLike, orderByClauseOf, pageOf, toUtcDate, whereClause } from "@/db/sql"

import type { RoleResponse } from "./roles.dto"

const ROLE_COLUMNS = "r.id, r.name, r.description, r.created_at"
const ROLE_FROM = "roles AS r"

/** Client sort key → SQL column expression, the map shape of P0 §3.4. */
const ROLE_SORT_COLUMNS = {
  name: "r.name",
  createdAt: "r.created_at",
} as const

const ROLE_TIEBREAK = "r.id ASC"
const ROLE_SEARCH_COLUMNS = ["r.name", "r.description"]

function roleRow(row: Record<string, unknown>): RoleResponse {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description === null ? null : String(row.description),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
  }
}

export type ListRolesFilter = {
  search?: string | undefined
}

export async function selectRoles(
  db: Pool,
  params: ListParams,
  filter: ListRolesFilter,
): Promise<{ nodes: RoleResponse[]; totalCount: number }> {
  const clauses: string[] = []
  const filterParams: unknown[] = []

  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${ROLE_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of ROLE_SEARCH_COLUMNS) filterParams.push(like)
  }

  const where = whereClause(clauses)
  const sortColumn = params.sortBy
    ? (ROLE_SORT_COLUMNS as Record<string, string>)[params.sortBy]
    : undefined
  const orderBy = orderByClauseOf(sortColumn, params.sort, ROLE_TIEBREAK)

  return pageOf(db, {
    pageSql: `SELECT ${ROLE_COLUMNS} FROM ${ROLE_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM ${ROLE_FROM}${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: roleRow,
  })
}

/** Single-role read, prepared for Batch 2's `admin.roles.read`. */
export async function selectRole(db: Pool, roleId: string): Promise<RoleResponse | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${ROLE_COLUMNS} FROM ${ROLE_FROM} WHERE r.id = ?`,
    [roleId],
  )
  return rows[0] ? roleRow(rows[0]) : null
}
