import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { ListParams, UserStatus } from "@/db/models"
import { escapeLike, orderByClauseOf, pageOf, toUtcDate, whereClause } from "@/db/sql"
import { buildAssignments } from "@/db/updates"
import type { Scope } from "@/shared/auth/auth-context"

/**
 * A staff account as the API reads it: the `users` row with its branch's name
 * carried alongside (one join instead of one lookup per list row), plus role and
 * hub membership fetched separately for a whole page at once.
 */
export type StaffUserRecord = {
  id: string
  branchId: string | null
  branchName: string | null
  name: string
  email: string
  phone: string | null
  status: UserStatus
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

const USER_COLUMNS = `
  u.id, u.branch_id, u.name, u.email, u.phone, u.status, u.must_change_password,
  u.created_at, u.updated_at, b.name AS branch_name
`

const USER_FROM = "users AS u LEFT JOIN branches AS b ON b.id = u.branch_id"

/**
 * Client sort key → SQL column expression, the `rider-locations` shape rather
 * than an array allowlist: comparing `createdAt` to `u.created_at` directly
 * always fails, and the failure is a silent fallback to the tiebreak, which is
 * how the lists covered by P0 §3.4 ended up looking merely unsorted.
 */
const USER_SORT_COLUMNS = {
  name: "u.name",
  email: "u.email",
  status: "u.status",
  createdAt: "u.created_at",
} as const

const USER_TIEBREAK = "u.id ASC"
const USER_SEARCH_COLUMNS = ["u.name", "u.email", "u.phone"]

const USER_PATCH_COLUMNS = {
  name: "name",
  phone: "phone",
  branchId: "branch_id",
  status: "status",
} as const

function userRow(row: Record<string, unknown>): StaffUserRecord {
  return {
    id: String(row.id),
    branchId: row.branch_id === null ? null : String(row.branch_id),
    branchName: row.branch_name === null ? null : String(row.branch_name),
    name: String(row.name),
    email: String(row.email),
    phone: row.phone === null ? null : String(row.phone),
    status: row.status as UserStatus,
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

/**
 * Branch/hub narrowing, mirroring `parcels.applyScope`: company-wide callers
 * see everyone; a caller with a branch sees that branch's users; hub membership
 * is matched through `user_hubs`, which nothing had ever written before this
 * module. Both clauses combine with AND when both are present, exactly as the
 * parcel guard does — one `Scope`, one reading of it.
 *
 * Pushes into the caller's clause/param arrays so the values land in the same
 * positional order as the filters that follow them.
 */
function applyScope(scope: Scope, clauses: string[], params: unknown[]): void {
  if (scope.isCompanyWide) return
  if (scope.branchId) {
    clauses.push("u.branch_id = ?")
    params.push(scope.branchId)
  }
  if (scope.hubIds.length > 0) {
    clauses.push(
      `u.id IN (SELECT uh.user_id FROM user_hubs AS uh WHERE uh.hub_id IN (${scope.hubIds
        .map(() => "?")
        .join(", ")}))`,
    )
    params.push(...scope.hubIds)
  }
}

export type ListUsersFilter = {
  status?: UserStatus | undefined
  branchId?: string | undefined
  search?: string | undefined
}

export async function selectUsers(
  db: Pool,
  scope: Scope,
  params: ListParams,
  filter: ListUsersFilter,
): Promise<{ nodes: StaffUserRecord[]; totalCount: number }> {
  const clauses: string[] = []
  const filterParams: unknown[] = []

  applyScope(scope, clauses, filterParams)

  if (filter.status) {
    clauses.push("u.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.branchId) {
    clauses.push("u.branch_id = ?")
    filterParams.push(filter.branchId)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${USER_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of USER_SEARCH_COLUMNS) filterParams.push(like)
  }

  const where = whereClause(clauses)
  const sortColumn = params.sortBy
    ? (USER_SORT_COLUMNS as Record<string, string>)[params.sortBy]
    : undefined
  const orderBy = orderByClauseOf(sortColumn, params.sort, USER_TIEBREAK)

  return pageOf(db, {
    pageSql: `SELECT ${USER_COLUMNS} FROM ${USER_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM ${USER_FROM}${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: userRow,
  })
}

/** One account, in scope. Out of scope reads as missing, not as 403. */
export async function selectUser(
  db: Pool | Connection,
  scope: Scope,
  userId: string,
): Promise<StaffUserRecord | null> {
  const clauses: string[] = ["u.id = ?"]
  const params: unknown[] = [userId]
  applyScope(scope, clauses, params)

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${USER_COLUMNS} FROM ${USER_FROM} WHERE ${clauses.join(" AND ")}`,
    params,
  )
  return rows[0] ? userRow(rows[0]) : null
}

/**
 * Role and hub membership for a whole page of accounts in one query each —
 * the list row renders role badges and the edit form needs the same ids, so
 * fetching per row would be one N+1 per screen.
 */
export async function selectUserRoles(
  db: Pool | Connection,
  userIds: string[],
): Promise<{ userId: string; roleId: string; roleName: string }[]> {
  if (userIds.length === 0) return []
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ur.user_id, ur.role_id, r.name AS role_name
       FROM user_roles AS ur
       INNER JOIN roles AS r ON r.id = ur.role_id
      WHERE ur.user_id IN (${userIds.map(() => "?").join(", ")})
      ORDER BY r.name ASC`,
    userIds,
  )
  return rows.map((row) => ({
    userId: String(row.user_id),
    roleId: String(row.role_id),
    roleName: String(row.role_name),
  }))
}

export async function selectUserHubs(
  db: Pool | Connection,
  userIds: string[],
): Promise<{ userId: string; hubId: string; hubName: string }[]> {
  if (userIds.length === 0) return []
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT uh.user_id, uh.hub_id, h.name AS hub_name
       FROM user_hubs AS uh
       INNER JOIN hubs AS h ON h.id = uh.hub_id
      WHERE uh.user_id IN (${userIds.map(() => "?").join(", ")})
      ORDER BY h.name ASC`,
    userIds,
  )
  return rows.map((row) => ({
    userId: String(row.user_id),
    hubId: String(row.hub_id),
    hubName: String(row.hub_name),
  }))
}

export async function selectRoleIdsForUser(
  db: Pool | Connection,
  userId: string,
): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT role_id FROM user_roles WHERE user_id = ?`,
    [userId],
  )
  return rows.map((row) => String(row.role_id))
}

export async function selectRoleIdByName(
  db: Pool | Connection,
  name: string,
): Promise<string | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT id FROM roles WHERE name = ? LIMIT 1`, [
    name,
  ])
  return rows[0] ? String(rows[0].id) : null
}

/**
 * How many ACTIVE ADMIN accounts exist other than this one — the whole
 * last-admin guard. Deliberately unscoped: it answers a company invariant
 * ("is anyone left who can unlock the door"), which a branch view of the
 * data cannot answer.
 */
export async function countActiveAdminsExcluding(
  db: Pool | Connection,
  userId: string,
): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT u.id) AS count
       FROM users AS u
       INNER JOIN user_roles AS ur ON ur.user_id = u.id
       INNER JOIN roles AS r ON r.id = ur.role_id
      WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE' AND u.id <> ?`,
    [userId],
  )
  return Number(rows[0]?.count ?? 0)
}

/** Which of the submitted ids actually exist, for a FK-shaped 422 up front. */
const EXISTING_TABLES = {
  roles: "roles",
  hubs: "hubs",
  branches: "branches",
} as const

export async function selectExistingIds(
  db: Pool | Connection,
  table: keyof typeof EXISTING_TABLES,
  ids: string[],
): Promise<Set<string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Set()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id FROM ${EXISTING_TABLES[table]} WHERE id IN (${unique.map(() => "?").join(", ")})`,
    unique,
  )
  return new Set(rows.map((row) => String(row.id)))
}

export async function insertUser(
  db: Pool | Connection,
  record: {
    name: string
    email: string
    phone: string | null
    passwordHash: string
    status: UserStatus
    branchId: string | null
  },
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO users (name, email, phone, password_hash, must_change_password, status, branch_id)
     VALUES (?, ?, ?, ?, TRUE, ?, ?)`,
    [record.name, record.email, record.phone, record.passwordHash, record.status, record.branchId],
  )
  if (!result.insertId) throw new Error("User insert returned no id")
  return String(result.insertId)
}

/**
 * No scope clause here: the service loads the row in scope first and then
 * patches it, so the guard lives in one place instead of being spelled twice.
 */
export async function patchUser(
  db: Pool | Connection,
  userId: string,
  patch: Partial<Pick<StaffUserRecord, "name" | "phone" | "branchId" | "status">>,
): Promise<void> {
  const { assignments, params } = buildAssignments(patch, USER_PATCH_COLUMNS)
  if (assignments.length === 0) return
  params.push(userId)
  await db.execute<OkPacket>(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?`, params)
}

/**
 * Replace, never merge: revocation is the point of an assignment screen, and a
 * merge cannot express "these two roles and no others". Written as one DELETE
 * plus a loop of single-row inserts — the counts are a handful of rows inside a
 * transaction, and mysql2's `VALUES ?` bulk form is not used anywhere else here
 * to imitate.
 */
export async function replaceUserRoles(
  db: Pool | Connection,
  userId: string,
  roleIds: string[],
): Promise<void> {
  await db.execute(`DELETE FROM user_roles WHERE user_id = ?`, [userId])
  for (const roleId of new Set(roleIds)) {
    await db.execute(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, roleId])
  }
}

export async function replaceUserHubs(
  db: Pool | Connection,
  userId: string,
  hubIds: string[],
): Promise<void> {
  await db.execute(`DELETE FROM user_hubs WHERE user_id = ?`, [userId])
  for (const hubId of new Set(hubIds)) {
    await db.execute(`INSERT INTO user_hubs (user_id, hub_id) VALUES (?, ?)`, [userId, hubId])
  }
}

/**
 * The password write, alone: it sets `must_change_password` in the same
 * statement so the two can never end up half-flipped — a hash with the flag
 * still false would let the temporary password live on quietly.
 */
export async function updatePasswordHash(
  db: Pool | Connection,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.execute<OkPacket>(
    `UPDATE users SET password_hash = ?, must_change_password = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [passwordHash, userId],
  )
}
