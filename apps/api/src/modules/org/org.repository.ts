import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"
import type { Branch, Hub, HubWithBranch, ListParams } from "@/db/models"
import {
  escapeLike,
  orderByClauseOf,
  pageOf,
  sortColumnOf,
  toDecimal,
  toNullableDecimal,
  toStringOrNull,
  toUtcDate,
  whereClause,
} from "@/db/sql"
import { buildAssignments } from "@/db/updates"

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
const BRANCH_TIEBREAK = "b.name ASC, b.id ASC"
const HUB_SORT_COLUMNS = ["h.name", "h.code", "h.type", "h.status", "h.created_at"] as const
const HUB_TIEBREAK = "h.name ASC, h.id ASC"

const BRANCH_PATCH_COLUMNS = {
  name: "name",
  code: "code",
  phone: "phone",
  address: "address",
  city: "city",
  district: "district",
  latitude: "latitude",
  longitude: "longitude",
  status: "status",
} as const

const HUB_PATCH_COLUMNS = {
  branchId: "branch_id",
  name: "name",
  code: "code",
  type: "type",
  address: "address",
  district: "district",
  latitude: "latitude",
  longitude: "longitude",
  capacity: "capacity",
  status: "status",
} as const

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
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
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
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
    branchName: String(row.branch_name),
    branchCode: String(row.branch_code),
  }
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
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.status) {
    clauses.push("b.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${["b.name", "b.code", "b.district"].map((c) => `${c} LIKE ?`).join(" OR ")})`)
    filterParams.push(like, like, like)
  }
  const where = whereClause(clauses)

  const countSql = `SELECT COUNT(*) AS count FROM branches AS b${where ? " " + where : ""}`
  const orderBy = orderByClauseOf(
    sortColumnOf(params, BRANCH_SORT_COLUMNS),
    params.sort,
    BRANCH_TIEBREAK,
  )

  return pageOf(db, {
    pageSql: `SELECT ${BRANCH_COLUMNS} FROM branches AS b ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql,
    filterParams,
    params,
    decode: branchRow,
  })
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
  const { assignments, params } = buildAssignments(patch, BRANCH_PATCH_COLUMNS)

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
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.branchId) {
    clauses.push("h.branch_id = ?")
    filterParams.push(filter.branchId)
  }
  if (filter.type) {
    clauses.push("h.type = ?")
    filterParams.push(filter.type)
  }
  if (filter.status) {
    clauses.push("h.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${["h.name", "h.code", "h.district"].map((c) => `${c} LIKE ?`).join(" OR ")})`)
    filterParams.push(like, like, like)
  }
  const where = whereClause(clauses)

  const countSql = `SELECT COUNT(*) AS count FROM hubs AS h${where ? " " + where : ""}`
  const orderBy = orderByClauseOf(sortColumnOf(params, HUB_SORT_COLUMNS), params.sort, HUB_TIEBREAK)

  return pageOf(db, {
    pageSql: `SELECT ${HUB_COLUMNS} FROM hubs AS h LEFT JOIN branches AS br ON br.id = h.branch_id ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql,
    filterParams,
    params,
    decode: hubRow,
  })
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
  const { assignments, params } = buildAssignments(patch, HUB_PATCH_COLUMNS)

  if (assignments.length === 0) return selectHub(db, hubId)

  const sql = `UPDATE hubs SET ${assignments.join(", ")} WHERE id = ?`
  params.push(hubId)

  await db.execute<OkPacket>(sql, params)
  return selectHub(db, hubId)
}
