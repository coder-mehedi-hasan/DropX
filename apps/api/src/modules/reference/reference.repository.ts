import type { CustomerStatus, CustomerType, HubStatus, HubType, ListParams } from "@/db/models"
import type { Scope } from "@/shared/auth/auth-context"
import type { Pool, RowDataPacket } from "mysql2/promise"

/**
 * Reference reads, for pickers.
 *
 * These are deliberately not table dumps. A combobox needs an id and something a
 * human can recognise among ten; it does not need consent timestamps, GPS
 * coordinates, or a capacity figure. Every projection below is the smallest set
 * that lets someone pick the right row, because these endpoints get called on
 * every keystroke of every picker in Phases 1-4 and the payloads add up.
 *
 * Keeping them separate is also what keeps `customer_addresses` out of reach: it
 * is never joined here, so there is no way for a picker response to carry a
 * customer's address history by accident.
 */

export type HubRef = {
  id: string
  name: string
  code: string
  type: HubType
  district: string | null
  status: HubStatus
}

export type BranchRef = {
  id: string
  name: string
  code: string
  status: "ACTIVE" | "INACTIVE"
}

export type CustomerRef = {
  id: string
  code: string
  name: string
  phone: string
  email: string | null
  type: CustomerType
  status: CustomerStatus
}

const HUB_COLUMNS = "h.id, h.name, h.code, h.type, h.district, h.status"
const CUSTOMER_COLUMNS = "c.id, c.code, c.name, c.phone, c.email, c.type, c.status"

const HUB_SORT_COLUMNS = ["h.name", "h.code", "h.type", "h.status"] as const
const CUSTOMER_SORT_COLUMNS = ["c.name", "c.phone", "c.created_at", "c.id"] as const
const BRANCH_SORT_COLUMNS = ["b.name", "b.code", "b.status"] as const

const BRANCH_COLUMNS = "b.id, b.name, b.code, b.status"

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ")
}

type Clause = { text: string; params: unknown[] }

/**
 * Joins conditions into a single parenthesised expression — **not** a `WHERE`
 * clause. A scope clause is one of several conditions a caller combines, so
 * baking `WHERE` in here produced `WHERE (WHERE (h.branch_id = ?))` for any
 * scoped caller, which is a syntax error rather than a wrong result. Callers
 * prefix the keyword.
 */
function combineClauses(clauses: Clause[]): Clause {
  if (clauses.length === 0) return { text: "", params: [] }
  return {
    text: `(${clauses.map((c) => c.text).join(") AND (")})`,
    params: clauses.flatMap((c) => c.params),
  }
}

async function pageOf<T>(
  db: Pool,
  sql: string,
  params: unknown[],
  countSql: string,
  countParams: unknown[],
  decode: (row: unknown) => T,
): Promise<{ nodes: T[]; totalCount: number }> {
  const [countRows] = await db.query<RowDataPacket[]>(countSql, countParams)
  const [rows] = await db.query<RowDataPacket[]>(sql, params)
  const countRow = countRows[0]
  const totalCount = countRow?.count == null ? 0 : Number(countRow.count)
  return { nodes: rows.map(decode), totalCount }
}

export type ListBranchesFilter = {
  search?: string | undefined
}

function decodeBranchRef(row: unknown): BranchRef {
  const r = row as Record<string, unknown>
  return {
    id: String(r.id),
    name: String(r.name),
    code: String(r.code),
    status: r.status as "ACTIVE" | "INACTIVE",
  }
}

export async function listBranchRefs(
  db: Pool,
  params: ListParams,
  filter: ListBranchesFilter,
): Promise<{ nodes: BranchRef[]; totalCount: number }> {
  const clauses: Clause[] = []
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push({
      text: `(${["b.name", "b.code"].map((c) => `${c} LIKE ?`).join(" OR ")})`,
      params: [like, like],
    })
  }
  const where = clauses.length ? `WHERE (${clauses.map((c) => c.text).join(") AND (")})` : ""
  const whereParams = clauses.flatMap((c) => c.params)

  const countSql = `SELECT COUNT(*) AS count FROM branches AS b${where ? " " + where : ""}`
  const sortColumn =
    params.sortBy && (BRANCH_SORT_COLUMNS as readonly string[]).includes(params.sortBy)
      ? params.sortBy
      : undefined
  const orderByClause = sortColumn
    ? `${sortColumn} ${params.sort.toUpperCase()}, b.name ASC, b.id ASC`
    : `b.name ASC, b.id ASC`

  const pageSql = `SELECT ${BRANCH_COLUMNS} FROM branches AS b${where ? " " + where : ""} ORDER BY ${orderByClause} LIMIT ? OFFSET ?`

  return pageOf(
    db,
    pageSql,
    [...whereParams, params.limit, params.offset],
    countSql,
    whereParams,
    decodeBranchRef,
  )
}

export type ListHubRefsFilter = {
  type?: HubType | undefined
  status?: HubStatus | undefined
  search?: string | undefined
}

function decodeHubRef(row: unknown): HubRef {
  const r = row as Record<string, unknown>
  return {
    id: String(r.id),
    name: String(r.name),
    code: String(r.code),
    type: r.type as HubType,
    district: toStringOrNull(r.district),
    status: r.status as HubStatus,
  }
}

export async function listHubRefs(
  db: Pool,
  scope: Scope,
  params: ListParams,
  filter: ListHubRefsFilter,
): Promise<{ nodes: HubRef[]; totalCount: number }> {
  const clauses: Clause[] = []
  const scopeClause = applyHubScope(scope)
  if (scopeClause.params.length) clauses.push(scopeClause)
  if (filter.type) clauses.push({ text: "h.type = ?", params: [filter.type] })
  if (filter.status) clauses.push({ text: "h.status = ?", params: [filter.status] })
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push({
      text: `(${["h.name", "h.code", "h.district"].map((c) => `${c} LIKE ?`).join(" OR ")})`,
      params: [like, like, like],
    })
  }
  const where = clauses.length ? `WHERE (${clauses.map((c) => c.text).join(") AND (")})` : ""
  const whereParams = clauses.flatMap((c) => c.params)

  const countSql = `SELECT COUNT(*) AS count FROM hubs AS h${where ? " " + where : ""}`
  const sortColumn =
    params.sortBy && (HUB_SORT_COLUMNS as readonly string[]).includes(params.sortBy)
      ? params.sortBy
      : undefined
  const orderByClause = sortColumn
    ? `${sortColumn} ${params.sort.toUpperCase()}, h.name ASC, h.id ASC`
    : `h.name ASC, h.id ASC`

  const pageSql = `SELECT ${HUB_COLUMNS} FROM hubs AS h${where ? " " + where : ""} ORDER BY ${orderByClause} LIMIT ? OFFSET ?`

  return pageOf(
    db,
    pageSql,
    [...whereParams, params.limit, params.offset],
    countSql,
    whereParams,
    decodeHubRef,
  )
}

export async function searchCustomerRefs(
  db: Pool,
  params: ListParams,
  filter: { search?: string | undefined; status?: CustomerStatus | undefined },
): Promise<{ nodes: CustomerRef[]; totalCount: number }> {
  const clauses: Clause[] = []
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push({
      text: `(${["c.code", "c.name", "c.phone", "c.email"].map((c) => `${c} LIKE ?`).join(" OR ")})`,
      params: [like, like, like, like],
    })
  }
  if (filter.status) clauses.push({ text: "c.status = ?", params: [filter.status] })
  const where = clauses.length ? `WHERE (${clauses.map((c) => c.text).join(") AND (")})` : ""
  const whereParams = clauses.flatMap((c) => c.params)

  const countSql = `SELECT COUNT(*) AS count FROM customers AS c${where ? " " + where : ""}`
  const sortColumn =
    params.sortBy && (CUSTOMER_SORT_COLUMNS as readonly string[]).includes(params.sortBy)
      ? params.sortBy
      : undefined
  const orderByClause = sortColumn
    ? `${sortColumn} ${params.sort.toUpperCase()}, c.name ASC, c.phone ASC, c.created_at ASC, c.id ASC`
    : `c.name ASC, c.phone ASC, c.created_at ASC, c.id ASC`

  const pageSql = `SELECT ${CUSTOMER_COLUMNS} FROM customers AS c${where ? " " + where : ""} ORDER BY ${orderByClause} LIMIT ? OFFSET ?`

  return pageOf(
    db,
    pageSql,
    [...whereParams, params.limit, params.offset],
    countSql,
    whereParams,
    decodeCustomerRef,
  )
}

function decodeCustomerRef(row: unknown): CustomerRef {
  const r = row as Record<string, unknown>
  return {
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    phone: String(r.phone),
    email: toStringOrNull(r.email),
    type: r.type as CustomerType,
    status: r.status as CustomerStatus,
  }
}

function applyHubScope(scope: Scope): Clause {
  const clauses: Clause[] = []
  if (scope.isCompanyWide) return combineClauses(clauses)
  if (scope.branchId) clauses.push({ text: "h.branch_id = ?", params: [scope.branchId] })
  if (scope.hubIds.length > 0) {
    clauses.push({ text: `h.id IN (${placeholders(scope.hubIds.length)})`, params: scope.hubIds })
  }
  return combineClauses(clauses)
}

function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}
