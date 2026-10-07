/**
 * Server-side database metadata and list arithmetic.
 *
 * The entity shapes and status vocabularies live in `@dropx/types` — the wire
 * contract, which every app imports. They are re-exported here so the many API
 * modules that already import from `../db/models` keep working unchanged; this
 * file is now only the part that must never leave the server.
 *
 * That part is table names (SQL text) and the pagination arithmetic that turns a
 * query string into `{ nodes, meta }`. Both need to stay out of the browser
 * bundle, and both depend on request-shaped input rather than the response shape.
 */

export * from "@dropx/types"

import type { Id, Page } from "@dropx/types"

// ---------------------------------------------------------------------------
// Table names
// ---------------------------------------------------------------------------

export const TABLES = {
  roles: "roles",
  branches: "branches",
  hubs: "hubs",
  users: "users",
  userRoles: "user_roles",
  rolePermissions: "role_permissions",
  userHubs: "user_hubs",
  customers: "customers",
  customerAddresses: "customer_addresses",
  serviceCities: "service_cities",
  serviceZones: "service_zones",
  serviceAreas: "service_areas",
  pricingLanes: "pricing_lanes",
  pricingSlabs: "pricing_slabs",
  vehicles: "vehicles",
  routes: "routes",
  routeStops: "route_stops",
  riders: "riders",
  riderApplications: "rider_applications",
  riderLocations: "rider_locations",
  parcels: "parcels",
  parcelAddresses: "parcel_addresses",
  parcelItems: "parcel_items",
  pickups: "pickups",
  transfers: "transfers",
  transferParcels: "transfer_parcels",
  deliveries: "deliveries",
  deliveryProofs: "delivery_proofs",
  parcelEvents: "parcel_events",
  payments: "payments",
  settlements: "settlements",
  notifications: "notifications",
  supportTickets: "support_tickets",
  auditLogs: "audit_logs",
} as const

export type TableName = (typeof TABLES)[keyof typeof TABLES]

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

export type SortDirection = "asc" | "desc"

export const SORT_DIRECTIONS: readonly SortDirection[] = ["asc", "desc"] as const

export function isSortDirection(value: unknown): value is SortDirection {
  return value === "asc" || value === "desc"
}

export type ListQuery = {
  page?: number | string | null
  limit?: number | string | null
  sortBy?: string | null
  sort?: string | null
  search?: string | null
}

export type ListParams = {
  page: number
  limit: number
  sortBy?: string | undefined
  sort: SortDirection
  search?: string | undefined
  offset: number
}

function toPositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed)) return fallback
  const int = Math.trunc(parsed)
  if (int < 1) return fallback
  return Math.min(int, max)
}

export function normalizeListParams(query: ListQuery = {}): ListParams {
  const page = toPositiveInt(query.page, DEFAULT_PAGE, Number.MAX_SAFE_INTEGER)
  const limit = toPositiveInt(query.limit, DEFAULT_LIMIT, MAX_LIMIT)
  const sort = isSortDirection(query.sort) ? query.sort : "desc"
  const search = query.search?.trim()

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    sort,
    sortBy: query.sortBy?.trim() || undefined,
    search: search ? search : undefined,
  }
}

export function buildPage<T>(nodes: T[], totalCount: number, params: ListParams): Page<T> {
  const totalPages = params.limit > 0 ? Math.ceil(totalCount / params.limit) : 0

  return {
    nodes,
    meta: {
      totalCount,
      currentPage: params.page,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1 && totalPages > 0,
    },
  }
}

export function emptyPage<T>(params: ListParams): Page<T> {
  return buildPage<T>([], 0, params)
}

export type PageWindow = {
  limit: number
  offset: number
}

export function toWindow(params: ListParams): PageWindow {
  return { limit: params.limit, offset: params.offset }
}

export type Identifiable = { id: Id }
