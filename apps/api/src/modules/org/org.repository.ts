import {
  InsertBuilder,
  QueryBuilder,
  TABLES,
  UpdateBuilder,
  toDecimal,
  toId,
  toNullableDecimal,
  toStringOrNull,
  type Executor,
  type Id,
  type ListParams,
} from "@dropx/db"

import type { Branch, Hub, HubWithBranch } from "@dropx/db"

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
    id: toId(row.id),
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
    id: toId(row.id),
    branchId: toId(row.branch_id),
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

async function pageOf<T>(
  db: Executor,
  builder: QueryBuilder,
  params: ListParams,
  decode: (row: Record<string, unknown>) => T,
): Promise<{ nodes: T[]; totalCount: number }> {
  const countQuery = builder.buildCount()
  const pageQuery = builder.limit(params.limit).offset(params.offset).build()

  const [totalCount, rows] = await Promise.all([
    db.count(countQuery.sql, countQuery.params),
    db.query<T>(pageQuery.sql, pageQuery.params),
  ])

  return { nodes: (rows.rows as Record<string, unknown>[]).map(decode), totalCount }
}

export type ListBranchesFilter = {
  status?: Branch["status"] | undefined
  search?: string | undefined
}

export async function selectBranches(
  db: Executor,
  params: ListParams,
  filter: ListBranchesFilter,
): Promise<{ nodes: Branch[]; totalCount: number }> {
  const builder = new QueryBuilder().select(BRANCH_COLUMNS).from(TABLES.branches, "b")

  if (filter.status) builder.where("b.status = ?", filter.status)
  builder.whereSearch(filter.search, ["b.name", "b.code", "b.district"])

  return pageOf(
    db,
    builder.orderByListParams(params, BRANCH_SORT_COLUMNS, [
      { column: "b.name", direction: "asc" },
      { column: "b.id", direction: "asc" },
    ]),
    params,
    branchRow,
  )
}

export async function selectBranch(db: Executor, branchId: Id): Promise<Branch | null> {
  const builder = new QueryBuilder()
    .select(BRANCH_COLUMNS)
    .from(TABLES.branches, "b")
    .where("b.id = ?", branchId)

  const { sql, params } = builder.build()
  const row = await db.queryOne<Record<string, unknown>>(sql, params)
  return row ? branchRow(row) : null
}

export async function insertBranch(
  db: Executor,
  record: Omit<Branch, "id" | "createdAt" | "updatedAt">,
): Promise<Id> {
  const { sql, params } = new InsertBuilder(TABLES.branches, {
    name: record.name,
    code: record.code,
    phone: record.phone,
    address: record.address,
    city: record.city,
    district: record.district,
    latitude: record.latitude,
    longitude: record.longitude,
    status: record.status,
  }).build()

  const result = await db.execute(sql, params)
  if (!result.insertId) throw new Error("Branch insert returned no id")
  return result.insertId
}

export async function patchBranch(
  db: Executor,
  branchId: Id,
  patch: Partial<Omit<Branch, "id" | "createdAt" | "updatedAt">>,
): Promise<Branch | null> {
  const builder = new UpdateBuilder(TABLES.branches, patch).where("id = ?", branchId)
  const query = builder.build()

  if (!query) return selectBranch(db, branchId)

  await db.execute(query.sql, query.params)
  return selectBranch(db, branchId)
}

export type ListHubsFilter = {
  branchId?: Id | undefined
  type?: Hub["type"] | undefined
  status?: Hub["status"] | undefined
  search?: string | undefined
}

export async function selectHubs(
  db: Executor,
  params: ListParams,
  filter: ListHubsFilter,
): Promise<{ nodes: HubWithBranch[]; totalCount: number }> {
  const builder = new QueryBuilder()
    .select(HUB_COLUMNS)
    .from(TABLES.hubs, "h")
    .leftJoin(TABLES.branches, "br.id = h.branch_id", "br")

  if (filter.branchId) builder.where("h.branch_id = ?", filter.branchId)
  if (filter.type) builder.where("h.type = ?", filter.type)
  if (filter.status) builder.where("h.status = ?", filter.status)
  builder.whereSearch(filter.search, ["h.name", "h.code", "h.district"])

  return pageOf(
    db,
    builder.orderByListParams(params, HUB_SORT_COLUMNS, [
      { column: "h.name", direction: "asc" },
      { column: "h.id", direction: "asc" },
    ]),
    params,
    hubRow,
  )
}

export async function selectHub(db: Executor, hubId: Id): Promise<HubWithBranch | null> {
  const builder = new QueryBuilder()
    .select(HUB_COLUMNS)
    .from(TABLES.hubs, "h")
    .leftJoin(TABLES.branches, "br.id = h.branch_id", "br")
    .where("h.id = ?", hubId)

  const { sql, params } = builder.build()
  const row = await db.queryOne<Record<string, unknown>>(sql, params)
  return row ? hubRow(row) : null
}

export async function insertHub(
  db: Executor,
  record: Omit<Hub, "id" | "createdAt" | "updatedAt">,
): Promise<Id> {
  const { sql, params } = new InsertBuilder(TABLES.hubs, {
    branch_id: record.branchId,
    name: record.name,
    code: record.code,
    type: record.type,
    address: record.address,
    district: record.district,
    latitude: record.latitude,
    longitude: record.longitude,
    capacity: record.capacity,
    status: record.status,
  }).build()

  const result = await db.execute(sql, params)
  if (!result.insertId) throw new Error("Hub insert returned no id")
  return result.insertId
}

export async function patchHub(
  db: Executor,
  hubId: Id,
  patch: Partial<Omit<Hub, "id" | "createdAt" | "updatedAt">>,
): Promise<HubWithBranch | null> {
  const builder = new UpdateBuilder(TABLES.hubs, patch).where("id = ?", hubId)
  const query = builder.build()

  if (!query) return selectHub(db, hubId)

  await db.execute(query.sql, query.params)
  return selectHub(db, hubId)
}
