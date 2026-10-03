import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"
import type { Branch, Hub, HubWithBranch, ListParams } from "@/db/models"

/**
 * Persistence for `branches` and `hubs`.
 *
 * Both are unscoped reads: DropX is single-tenant, and the Scope guard that
 * narrows a caller to their branch/hub applies to *parcel* data — a branch
 * manager creating a hub must pick its branch from a list, and that list is
 * company-wide by design. Scoping these tables would hide the very thing the
 * manager needs to choose from. The enforcement instead lives in the policy:
 * `branches.manage`/`hubs.manage` gate every write, and `hubs.view` gates reads.
 */

const BRANCH_COLUMNS = `
  b.id, b.name, b.code, b.phone, b.address, b.city, b.district,
  b.latitude, b.longitude, b.status, b.created_at, b.updated_at
`

const HUB_COLUMNS = `
  h.id, h.branch_id, h.name, h.code, h.type, h.address, h.district,
  h.latitude, h.longitude, h.capacity, h.status, h.created_at, h.updated_at,
  br.name AS branch_name, br.code AS branch_code
`

const BRANCH_SORT_COLUMNS = ["b.name", "b.code", "b.status", "b.created_at"] as const
const HUB_SORT_COLUMNS = ["h.name", "h.code", "h.type", "h.status", "h.created_at"] as const

function branchRow(row: Record<string, unknown>): Branch {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    phone: toStringOrNull(row.phone),
    address: toStringOrNull(row.address),
    city: toStringOrNull(row.city),
    district: toStringOrNull(row.district),
    latitude: toDecimal(row.latitude),
    longitude: toDecimal(row.longitude),
    status: row.status as Branch["status"],
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  }
}

function hubRow(row: Record<string, unknown>): HubWithBranch {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    name: String(row.name),
    code: String(row.code),
    type: row.type as Hub["type"],
    address: toStringOrNull(row.address),
    district: toStringOrNull(row.district),
    latitude: toDecimal(row.latitude),
    longitude: toDecimal(row.longitude),
    capacity: toNullableDecimal(row.capacity),
    status: row.status as Hub["status"],
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    branchName: String(row.branch_name),
    branchCode: String(row.branch_code),
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

function toNullableDecimal(value: unknown): number | null {
  return value === null || value === undefined ? null : toDecimal(value)
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

export type ListBranchesFilter = {
  status?: Branch["status"] | undefined
  search?: string | undefined
}

export async function selectBranches(
  db: Pool,
  params: ListParams,
  filter: ListBranchesFilter,
): Promise<{ nodes: Branch[]; totalCount: number }> {
  const paramsAcc = []
  const clauses: string[] = []

  if (filter.status) {
    clauses.push("b.status = ?")
    paramsAcc.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(
      `(${["b.name", "b.code", "b.district"].map((c) => `${c} LIKE ?`).join(" OR ")})`,
    )
    paramsAcc.push(like, like, like)
  }
  const where = clauses.length ? `WHERE (${clauses.join(") AND (")})` : ""

  const countSql = `SELECT COUNT(*) AS count FROM branches${where ? " " + where : ""}`
  const sortColumn =
    params.sortBy && (BRANCH_SORT_COLUMNS as readonly string[]).includes(params.sortBy) ? params.sortBy : undefined
  const orderByClause = sortColumn
    ? `${sortColumn} ${params.sort.toUpperCase()}, b.name ASC, b.id ASC`
    : `b.name ASC, b.id ASC`

  const pageSql =
    `SELECT ${BRANCH_COLUMNS} FROM branches AS b ${where} ORDER BY ${orderByClause} LIMIT ? OFFSET ?`
  const pageParams = [...paramsAcc, params.limit, params.offset]

  return pageOf(db, pageSql, pageParams, countSql, paramsAcc, branchRow)
}


export async function selectBranch(db: Pool, branchId: string): Promise<Branch | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${BRANCH_COLUMNS} FROM branches AS b WHERE b.id = ?`,
    [branchId],
  )
  return rows[0] ? branchRow(rows[0]) : null
}

export async function insertBranch(
  db: Pool,
  record: Omit<Branch, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const { sql, params } = branchInsertSql(record)
  const [result] = await db.execute<OkPacket>(sql, params)
  if (!result.insertId) throw new Error("Branch insert returned no id")
  return String(result.insertId)
}

function branchInsertSql(record: Omit<Branch, "id" | "createdAt" | "updatedAt">) {
  const params = [
    record.name,
    record.code,
    record.phone,
    record.address,
    record.city,
    record.district,
    record.latitude,
    record.longitude,
    record.status,
  ]
  const sql = `INSERT INTO branches (name, code, phone, address, city, district, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  return { sql, params }
}

export async function patchBranch(
  db: Pool,
  branchId: string,
  patch: Partial<Omit<Branch, "id" | "createdAt" | "updatedAt">>,
): Promise<Branch | null> {
  const assignments: string[] = []
  const params = []

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      assignments.push(`${key} = ?`)
      params.push(value)
    }
  }

  if (assignments.length === 0) return selectBranch(db, branchId)

  const sql = `UPDATE branches SET ${assignments.join(", ")} WHERE id = ?`
  params.push(branchId)

  await db.execute<OkPacket>(sql, params)
  return selectBranch(db, branchId)
}

export type ListHubsFilter = {
  branchId?: string | undefined
  type?: Hub["type"] | undefined
  status?: Hub["status"] | undefined
  search?: string | undefined
}

export async function selectHubs(
  db: Pool,
  params: ListParams,
  filter: ListHubsFilter,
): Promise<{ nodes: HubWithBranch[]; totalCount: number }> {
  const paramsAcc = []
  const clauses: string[] = []

  if (filter.branchId) {
    clauses.push("h.branch_id = ?")
    paramsAcc.push(filter.branchId)
  }
  if (filter.type) {
    clauses.push("h.type = ?")
    paramsAcc.push(filter.type)
  }
  if (filter.status) {
    clauses.push("h.status = ?")
    paramsAcc.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${["h.name", "h.code", "h.district"].map((c) => `${c} LIKE ?`).join(" OR ")})`)
    paramsAcc.push(like, like, like)
  }
  const where = clauses.length ? `WHERE (${clauses.join(") AND (")})` : ""

  const countSql = `SELECT COUNT(*) AS count FROM hubs${where ? " " + where : ""}`
  const sortColumn =
    params.sortBy && (HUB_SORT_COLUMNS as readonly string[]).includes(params.sortBy) ? params.sortBy : undefined
  const orderByClause = sortColumn
    ? `${sortColumn} ${params.sort.toUpperCase()}, h.name ASC, h.id ASC`
    : `h.name ASC, h.id ASC`

  const pageSql =
    `SELECT ${HUB_COLUMNS} FROM hubs AS h LEFT JOIN branches AS br ON br.id = h.branch_id ${where} ORDER BY ${orderByClause} LIMIT ? OFFSET ?`
  const pageParams = [...paramsAcc, params.limit, params.offset]

  return pageOf(db, pageSql, pageParams, countSql, paramsAcc, hubRow)
}

export async function selectHub(db: Pool, hubId: string): Promise<HubWithBranch | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${HUB_COLUMNS} FROM hubs AS h LEFT JOIN branches AS br ON br.id = h.branch_id WHERE h.id = ?`,
    [hubId],
  )
  return rows[0] ? hubRow(rows[0]) : null
}

export async function insertHub(
  db: Pool,
  record: Omit<Hub, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const params = [
    record.branchId,
    record.name,
    record.code,
    record.type,
    record.address,
    record.district,
    record.latitude,
    record.longitude,
    record.capacity,
    record.status,
  ]
  const sql = `INSERT INTO hubs (branch_id, name, code, type, address, district, latitude, longitude, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, params)
  if (!result.insertId) throw new Error("Hub insert returned no id")
  return String(result.insertId)
}

export async function patchHub(
  db: Pool,
  hubId: string,
  patch: Partial<Omit<Hub, "id" | "createdAt" | "updatedAt">>,
): Promise<HubWithBranch | null> {
  const assignments: string[] = []
  const params = []

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      assignments.push(`${key} = ?`)
      params.push(value)
    }
  }

  if (assignments.length === 0) return selectHub(db, hubId)

  const sql = `UPDATE hubs SET ${assignments.join(", ")} WHERE id = ?`
  params.push(hubId)

  await db.execute<OkPacket>(sql, params)
  return selectHub(db, hubId)
}
