import {
  QueryBuilder,
  TABLES,
  toId,
  toStringOrNull,
  type CustomerStatus,
  type CustomerType,
  type Executor,
  type HubStatus,
  type HubType,
  type ListParams,
  type RecordStatus,
} from "@dropx/db"

import type { Scope } from "../../shared/auth/auth-context"

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

export type ZoneRef = {
  id: string
  name: string
  code: string
  status: RecordStatus
}

export type CustomerRef = {
  id: string
  name: string
  phone: string
  email: string | null
  type: CustomerType
  status: CustomerStatus
}

const HUB_COLUMNS = "h.id, h.name, h.code, h.type, h.district, h.status"
const ZONE_COLUMNS = "z.id, z.name, z.code, z.status"
const CUSTOMER_COLUMNS = "c.id, c.name, c.phone, c.email, c.type, c.status"

const HUB_SORT_COLUMNS = ["h.name", "h.code", "h.type", "h.status"] as const
const ZONE_SORT_COLUMNS = ["z.name", "z.code", "z.status"] as const
const CUSTOMER_SORT_COLUMNS = ["c.name", "c.phone", "c.created_at", "c.id"] as const
const BRANCH_SORT_COLUMNS = ["b.name", "b.code", "b.status"] as const

const BRANCH_COLUMNS = "b.id, b.name, b.code, b.status"

/**
 * `hubs.branch_id` means a hub belongs to exactly one branch, so a hub picker
 * must be branch-scoped for the same reason the parcel list is: a branch manager
 * choosing an origin hub should see their own network, not the whole company's.
 * A hub-scoped role narrows further to its own hubs, and a company-wide ADMIN
 * sees everything.
 */
function applyHubScope(builder: QueryBuilder, scope: Scope): QueryBuilder {
  if (scope.isCompanyWide) return builder
  if (scope.branchId) builder.where("h.branch_id = ?", scope.branchId)
  if (scope.hubIds.length > 0) builder.whereIn("h.id", scope.hubIds)
  return builder
}

async function pageOf<T>(
  db: Executor,
  builder: QueryBuilder,
  params: ListParams,
  decode: (row: T) => T,
): Promise<{ nodes: T[]; totalCount: number }> {
  const countQuery = builder.buildCount()
  const pageQuery = builder.limit(params.limit).offset(params.offset).build()

  const [totalCount, rows] = await Promise.all([
    db.count(countQuery.sql, countQuery.params),
    db.query<T>(pageQuery.sql, pageQuery.params),
  ])

  return { nodes: rows.rows.map(decode), totalCount }
}

export type ListBranchesFilter = {
  search?: string | undefined
}

export async function listBranchRefs(
  db: Executor,
  params: ListParams,
  filter: ListBranchesFilter,
): Promise<{ nodes: BranchRef[]; totalCount: number }> {
  const builder = new QueryBuilder().select(BRANCH_COLUMNS).from(TABLES.branches, "b")
  builder.whereSearch(filter.search, ["b.name", "b.code"])

  return pageOf<BranchRef>(
    db,
    builder.orderByListParams(params, BRANCH_SORT_COLUMNS, [
      { column: "b.name", direction: "asc" },
      { column: "b.id", direction: "asc" },
    ]),
    params,
    (row) => ({
      id: toId(row.id),
      name: String(row.name),
      code: String(row.code),
      status: row.status as "ACTIVE" | "INACTIVE",
    }),
  )
}

export type ListHubRefsFilter = {
  type?: HubType | undefined
  status?: HubStatus | undefined
  search?: string | undefined
}

export async function listHubRefs(
  db: Executor,
  scope: Scope,
  params: ListParams,
  filter: ListHubRefsFilter,
): Promise<{ nodes: HubRef[]; totalCount: number }> {
  const builder = applyHubScope(
    new QueryBuilder().select(HUB_COLUMNS).from(TABLES.hubs, "h"),
    scope,
  )

  if (filter.type) builder.where("h.type = ?", filter.type)
  if (filter.status) builder.where("h.status = ?", filter.status)
  builder.whereSearch(filter.search, ["h.name", "h.code", "h.district"])

  const paged = await pageOf<HubRef>(
    db,
    builder.orderByListParams(params, HUB_SORT_COLUMNS, [
      { column: "h.name", direction: "asc" },
      { column: "h.id", direction: "asc" },
    ]),
    params,
    (row) => ({
      id: toId(row.id),
      name: row.name,
      code: row.code,
      type: row.type,
      district: toStringOrNull(row.district),
      status: row.status,
    }),
  )

  return paged
}

export async function listZoneRefs(
  db: Executor,
  params: ListParams,
  filter: { search?: string | undefined },
): Promise<{ nodes: ZoneRef[]; totalCount: number }> {
  const builder = new QueryBuilder().select(ZONE_COLUMNS).from(TABLES.zones, "z")
  builder.whereSearch(filter.search, ["z.name", "z.code"])

  return pageOf<ZoneRef>(
    db,
    builder.orderByListParams(params, ZONE_SORT_COLUMNS, [
      { column: "z.name", direction: "asc" },
      { column: "z.id", direction: "asc" },
    ]),
    params,
    (row) => ({
      id: toId(row.id),
      name: row.name,
      code: row.code,
      status: row.status,
    }),
  )
}

export async function searchCustomerRefs(
  db: Executor,
  params: ListParams,
  filter: { search?: string | undefined },
): Promise<{ nodes: CustomerRef[]; totalCount: number }> {
  const builder = new QueryBuilder().select(CUSTOMER_COLUMNS).from(TABLES.customers, "c")
  builder.whereSearch(filter.search, ["c.name", "c.phone", "c.email"])

  return pageOf<CustomerRef>(
    db,
    builder.orderByListParams(params, CUSTOMER_SORT_COLUMNS, [
      { column: "c.name", direction: "asc" },
      { column: "c.id", direction: "asc" },
    ]),
    params,
    (row) => ({
      id: toId(row.id),
      name: row.name,
      phone: row.phone,
      email: toStringOrNull(row.email),
      type: row.type,
      status: row.status,
    }),
  )
}
