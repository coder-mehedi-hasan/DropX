import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type {
  ListParams,
  ServiceArea,
  ServiceCity,
  ServiceZone,
} from "@/db/models"
import {
  escapeLike,
  orderByClauseOf,
  pageOf,
  sortColumnOf,
  toUtcDate,
  whereClause,
} from "@/db/sql"
import { buildAssignments } from "@/db/updates"

/**
 * SQL for the city → zone → area hierarchy.
 *
 * One file with three near-identical blocks rather than three files or one
 * generic table driver: the columns differ (`serviceType` exists only on the
 * city, the parent id differs on the other two) and a generic driver would move
 * the differences into a config object that nobody reads. The shapes are
 * parallel so the third block is a copy of the second with the names swapped.
 *
 * Sort columns are an allowlist here, next to the queries that use them: a
 * `sortBy` arrives from the query string, and interpolating it unchecked is
 * injection.
 */

// --- Cities -----------------------------------------------------------------

const CITY_COLUMNS = `
  c.id, c.name, c.code, c.service_type, c.status, c.created_at, c.updated_at
`

const CITY_SORT_COLUMNS = [
  "c.name",
  "c.code",
  "c.service_type",
  "c.status",
  "c.created_at",
] as const
const CITY_TIEBREAK = "c.name ASC, c.id ASC"
const CITY_SEARCH_COLUMNS = ["c.name", "c.code"]

const CITY_PATCH_COLUMNS = {
  name: "name",
  code: "code",
  serviceType: "service_type",
  status: "status",
} as const

function cityRow(row: Record<string, unknown>): ServiceCity {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    serviceType: row.service_type as ServiceCity["serviceType"],
    status: row.status as ServiceCity["status"],
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

export type CityFilter = {
  status?: ServiceCity["status"] | undefined
  serviceType?: ServiceCity["serviceType"] | undefined
  search?: string | undefined
}

export async function selectServiceCities(
  db: Pool,
  params: ListParams,
  filter: CityFilter,
): Promise<{ nodes: ServiceCity[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.status) {
    clauses.push("c.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.serviceType) {
    clauses.push("c.service_type = ?")
    filterParams.push(filter.serviceType)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${CITY_SEARCH_COLUMNS.map((col) => `${col} LIKE ?`).join(" OR ")})`)
    for (const _ of CITY_SEARCH_COLUMNS) filterParams.push(like)
  }
  const where = whereClause(clauses)
  const orderBy = orderByClauseOf(
    sortColumnOf(params, CITY_SORT_COLUMNS),
    params.sort,
    CITY_TIEBREAK,
  )

  return pageOf(db, {
    pageSql: `SELECT ${CITY_COLUMNS} FROM service_cities AS c ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM service_cities AS c${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: cityRow,
  })
}

export async function selectServiceCity(db: Pool, cityId: string): Promise<ServiceCity | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${CITY_COLUMNS} FROM service_cities AS c WHERE c.id = ?`,
    [cityId],
  )
  return rows[0] ? cityRow(rows[0]) : null
}

export async function insertServiceCity(
  db: Pool,
  record: Omit<ServiceCity, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO service_cities (name, code, service_type, status) VALUES (?, ?, ?, ?)`,
    [record.name, record.code, record.serviceType, record.status],
  )
  if (!result.insertId) throw new Error("Service city insert returned no id")
  return String(result.insertId)
}

export async function patchServiceCity(
  db: Pool,
  cityId: string,
  patch: Partial<Omit<ServiceCity, "id" | "createdAt" | "updatedAt">>,
): Promise<ServiceCity | null> {
  const { assignments, params } = buildAssignments(patch, CITY_PATCH_COLUMNS)
  if (assignments.length === 0) return selectServiceCity(db, cityId)

  params.push(cityId)
  await db.execute<OkPacket>(
    `UPDATE service_cities SET ${assignments.join(", ")} WHERE id = ?`,
    params,
  )
  return selectServiceCity(db, cityId)
}

// --- Zones ------------------------------------------------------------------

const ZONE_COLUMNS = `
  z.id, z.city_id, z.name, z.code, z.status, z.created_at, z.updated_at
`

const ZONE_SORT_COLUMNS = ["z.name", "z.code", "z.status", "z.created_at"] as const
const ZONE_TIEBREAK = "z.name ASC, z.id ASC"
const ZONE_SEARCH_COLUMNS = ["z.name", "z.code"]

const ZONE_PATCH_COLUMNS = {
  cityId: "city_id",
  name: "name",
  code: "code",
  status: "status",
} as const

function zoneRow(row: Record<string, unknown>): ServiceZone {
  return {
    id: String(row.id),
    cityId: String(row.city_id),
    name: String(row.name),
    code: String(row.code),
    status: row.status as ServiceZone["status"],
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

export type ZoneFilter = {
  cityId?: string | undefined
  status?: ServiceZone["status"] | undefined
  search?: string | undefined
}

export async function selectServiceZones(
  db: Pool,
  params: ListParams,
  filter: ZoneFilter,
): Promise<{ nodes: ServiceZone[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.cityId) {
    clauses.push("z.city_id = ?")
    filterParams.push(filter.cityId)
  }
  if (filter.status) {
    clauses.push("z.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${ZONE_SEARCH_COLUMNS.map((col) => `${col} LIKE ?`).join(" OR ")})`)
    for (const _ of ZONE_SEARCH_COLUMNS) filterParams.push(like)
  }
  const where = whereClause(clauses)
  const orderBy = orderByClauseOf(
    sortColumnOf(params, ZONE_SORT_COLUMNS),
    params.sort,
    ZONE_TIEBREAK,
  )

  return pageOf(db, {
    pageSql: `SELECT ${ZONE_COLUMNS} FROM service_zones AS z ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM service_zones AS z${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: zoneRow,
  })
}

export async function selectServiceZone(db: Pool, zoneId: string): Promise<ServiceZone | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${ZONE_COLUMNS} FROM service_zones AS z WHERE z.id = ?`,
    [zoneId],
  )
  return rows[0] ? zoneRow(rows[0]) : null
}

export async function insertServiceZone(
  db: Pool,
  record: Omit<ServiceZone, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO service_zones (city_id, name, code, status) VALUES (?, ?, ?, ?)`,
    [record.cityId, record.name, record.code, record.status],
  )
  if (!result.insertId) throw new Error("Service zone insert returned no id")
  return String(result.insertId)
}

export async function patchServiceZone(
  db: Pool,
  zoneId: string,
  patch: Partial<Omit<ServiceZone, "id" | "createdAt" | "updatedAt">>,
): Promise<ServiceZone | null> {
  const { assignments, params } = buildAssignments(patch, ZONE_PATCH_COLUMNS)
  if (assignments.length === 0) return selectServiceZone(db, zoneId)

  params.push(zoneId)
  await db.execute<OkPacket>(
    `UPDATE service_zones SET ${assignments.join(", ")} WHERE id = ?`,
    params,
  )
  return selectServiceZone(db, zoneId)
}

// --- Areas ------------------------------------------------------------------

const AREA_COLUMNS = `
  a.id, a.zone_id, a.name, a.code, a.status, a.created_at, a.updated_at
`

const AREA_SORT_COLUMNS = ["a.name", "a.code", "a.status", "a.created_at"] as const
const AREA_TIEBREAK = "a.name ASC, a.id ASC"
const AREA_SEARCH_COLUMNS = ["a.name", "a.code"]

const AREA_PATCH_COLUMNS = {
  zoneId: "zone_id",
  name: "name",
  code: "code",
  status: "status",
} as const

function areaRow(row: Record<string, unknown>): ServiceArea {
  return {
    id: String(row.id),
    zoneId: String(row.zone_id),
    name: String(row.name),
    code: String(row.code),
    status: row.status as ServiceArea["status"],
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

export type AreaFilter = {
  zoneId?: string | undefined
  status?: ServiceArea["status"] | undefined
  search?: string | undefined
}

export async function selectServiceAreas(
  db: Pool,
  params: ListParams,
  filter: AreaFilter,
): Promise<{ nodes: ServiceArea[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.zoneId) {
    clauses.push("a.zone_id = ?")
    filterParams.push(filter.zoneId)
  }
  if (filter.status) {
    clauses.push("a.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${AREA_SEARCH_COLUMNS.map((col) => `${col} LIKE ?`).join(" OR ")})`)
    for (const _ of AREA_SEARCH_COLUMNS) filterParams.push(like)
  }
  const where = whereClause(clauses)
  const orderBy = orderByClauseOf(
    sortColumnOf(params, AREA_SORT_COLUMNS),
    params.sort,
    AREA_TIEBREAK,
  )

  return pageOf(db, {
    pageSql: `SELECT ${AREA_COLUMNS} FROM service_areas AS a ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM service_areas AS a${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: areaRow,
  })
}

export async function selectServiceArea(db: Pool, areaId: string): Promise<ServiceArea | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${AREA_COLUMNS} FROM service_areas AS a WHERE a.id = ?`,
    [areaId],
  )
  return rows[0] ? areaRow(rows[0]) : null
}

export async function insertServiceArea(
  db: Pool,
  record: Omit<ServiceArea, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO service_areas (zone_id, name, code, status) VALUES (?, ?, ?, ?)`,
    [record.zoneId, record.name, record.code, record.status],
  )
  if (!result.insertId) throw new Error("Service area insert returned no id")
  return String(result.insertId)
}

export async function patchServiceArea(
  db: Pool,
  areaId: string,
  patch: Partial<Omit<ServiceArea, "id" | "createdAt" | "updatedAt">>,
): Promise<ServiceArea | null> {
  const { assignments, params } = buildAssignments(patch, AREA_PATCH_COLUMNS)
  if (assignments.length === 0) return selectServiceArea(db, areaId)

  params.push(areaId)
  await db.execute<OkPacket>(
    `UPDATE service_areas SET ${assignments.join(", ")} WHERE id = ?`,
    params,
  )
  return selectServiceArea(db, areaId)
}

/** Not a row reader: `code` uniqueness is scoped to the parent, so a lookup has
 *  to know which parent it is asking about. Used by create validation only. */
export async function codeExistsUnderParent(
  db: Pool,
  table: "service_cities" | "service_zones" | "service_areas",
  scope: { cityId?: string; zoneId?: string },
  code: string,
  exceptId?: string,
): Promise<boolean> {
  const clauses = ["code = ?"]
  const params: unknown[] = [code]

  if (table === "service_cities") {
    // A city's code is globally unique.
  } else if (table === "service_zones") {
    clauses.push("city_id = ?")
    params.push(scope.cityId)
  } else {
    clauses.push("zone_id = ?")
    params.push(scope.zoneId)
  }
  if (exceptId) {
    clauses.push("id <> ?")
    params.push(exceptId)
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT 1 FROM ${table} WHERE ${clauses.join(" AND ")} LIMIT 1`,
    params,
  )
  return rows.length > 0
}
