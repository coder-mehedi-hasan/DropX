import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

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

export async function selectRole(
  db: Pool | Connection,
  roleId: string,
): Promise<RoleResponse | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${ROLE_COLUMNS} FROM ${ROLE_FROM} WHERE r.id = ?`,
    [roleId],
  )
  return rows[0] ? roleRow(rows[0]) : null
}

/** Granted keys for a role. Catalog order is the service's job — this is a set. */
export async function selectRolePermissions(
  db: Pool | Connection,
  roleId: string,
): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT permission_key FROM role_permissions WHERE role_id = ? ORDER BY permission_key`,
    [roleId],
  )
  return rows.map((row) => String(row.permission_key))
}

export async function insertRole(
  db: Pool | Connection,
  record: { name: string; description: string | null },
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO roles (name, description) VALUES (?, ?)`,
    [record.name, record.description],
  )
  if (!result.insertId) throw new Error("Role insert returned no id")
  return String(result.insertId)
}

/**
 * Full replacement, delete-then-insert. `role_permissions` has no update — a
 * row either exists or it does not — and this repo has no `VALUES ?` precedent,
 * so the honest version is a loop of single-row statements inside the caller's
 * transaction, exactly like the stop-list and manifest replacements.
 */
export async function replaceRolePermissions(
  db: Pool | Connection,
  roleId: string,
  keys: string[],
): Promise<void> {
  await db.execute(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId])
  for (const key of keys) {
    await db.execute(`INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)`, [
      roleId,
      key,
    ])
  }
}

/**
 * The lockout guard's one question: does any ACTIVE account still reach
 * `permissionKey` through a role *other than* `roleId`? Counted on
 * `DISTINCT user_id` because a user may hold the same key twice over.
 */
export async function countActiveHoldersExcludingRole(
  db: Pool | Connection,
  permissionKey: string,
  roleId: string,
): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT ur.user_id) AS count
       FROM user_roles AS ur
       INNER JOIN role_permissions AS rp ON rp.role_id = ur.role_id
       INNER JOIN users AS u ON u.id = ur.user_id
      WHERE rp.permission_key = ? AND u.status = 'ACTIVE' AND ur.role_id <> ?`,
    [permissionKey, roleId],
  )
  return Number(rows[0]?.count ?? 0)
}
