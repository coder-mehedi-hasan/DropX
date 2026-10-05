import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { ListParams, Route, RouteStop } from "@/db/models"
import {
  escapeLike,
  orderByClauseOf,
  pageOf,
  sortColumnOf,
  toNullableDecimal,
  toUtcDate,
  whereClause,
} from "@/db/sql"
import { buildAssignments } from "@/db/updates"

const ROUTE_COLUMNS = `
  r.id, r.name, r.code, r.origin_hub_id, r.destination_hub_id,
  r.distance_km, r.estimated_minutes, r.status, r.created_at, r.updated_at
`

const ROUTE_SORT_COLUMNS = ["r.name", "r.code", "r.status", "r.created_at"] as const
const ROUTE_TIEBREAK = "r.created_at DESC, r.id DESC"
const ROUTE_SEARCH_COLUMNS = ["r.name", "r.code"]

const ROUTE_PATCH_COLUMNS = {
  name: "name",
  code: "code",
  originHubId: "origin_hub_id",
  destinationHubId: "destination_hub_id",
  distanceKm: "distance_km",
  estimatedMinutes: "estimated_minutes",
  status: "status",
} as const

function routeRow(row: Record<string, unknown>): Route {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    originHubId: String(row.origin_hub_id),
    destinationHubId: String(row.destination_hub_id),
    distanceKm: toNullableDecimal(row.distance_km),
    estimatedMinutes:
      row.estimated_minutes === null || row.estimated_minutes === undefined
        ? null
        : Number(row.estimated_minutes),
    status: row.status as Route["status"],
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

function routeStopRow(row: Record<string, unknown>): RouteStop {
  return {
    id: String(row.id),
    routeId: String(row.route_id),
    hubId: String(row.hub_id),
    sequenceNo: Number(row.sequence_no),
    estimatedArrivalMinutes:
      row.estimated_arrival_minutes === null || row.estimated_arrival_minutes === undefined
        ? null
        : Number(row.estimated_arrival_minutes),
  }
}

export type ListRoutesFilter = {
  status?: Route["status"] | undefined
  search?: string | undefined
}

export async function selectRoutes(
  db: Pool,
  params: ListParams,
  filter: ListRoutesFilter,
): Promise<{ nodes: Route[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.status) {
    clauses.push("r.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${ROUTE_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of ROUTE_SEARCH_COLUMNS) filterParams.push(like)
  }
  const where = whereClause(clauses)
  const orderBy = orderByClauseOf(
    sortColumnOf(params, ROUTE_SORT_COLUMNS),
    params.sort,
    ROUTE_TIEBREAK,
  )

  return pageOf(db, {
    pageSql: `SELECT ${ROUTE_COLUMNS} FROM routes AS r ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM routes AS r${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: routeRow,
  })
}

export async function selectRoute(db: Pool, routeId: string): Promise<Route | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${ROUTE_COLUMNS} FROM routes AS r WHERE r.id = ?`,
    [routeId],
  )
  return rows[0] ? routeRow(rows[0]) : null
}

export async function insertRoute(
  db: Pool,
  record: Omit<Route, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const sql = `INSERT INTO routes (name, code, origin_hub_id, destination_hub_id, distance_km, estimated_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, [
    record.name,
    record.code,
    record.originHubId,
    record.destinationHubId,
    record.distanceKm,
    record.estimatedMinutes,
    record.status,
  ])
  if (!result.insertId) throw new Error("Route insert returned no id")
  return String(result.insertId)
}

export async function patchRoute(
  db: Pool,
  routeId: string,
  patch: Partial<Omit<Route, "id" | "createdAt" | "updatedAt">>,
): Promise<Route | null> {
  const { assignments, params } = buildAssignments(patch, ROUTE_PATCH_COLUMNS)

  if (assignments.length === 0) return selectRoute(db, routeId)

  const sql = `UPDATE routes SET ${assignments.join(", ")} WHERE id = ?`
  params.push(routeId)

  await db.execute<OkPacket>(sql, params)
  return selectRoute(db, routeId)
}

export async function deleteRoute(db: Pool, routeId: string): Promise<boolean> {
  const [result] = await db.execute<OkPacket>(`DELETE FROM routes WHERE id = ?`, [routeId])
  return Number(result.affectedRows) > 0
}

// --- Route stops -------------------------------------------------------------

export async function selectStops(db: Pool, routeId: string): Promise<RouteStop[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, route_id, hub_id, sequence_no, estimated_arrival_minutes
       FROM route_stops
      WHERE route_id = ?
      ORDER BY sequence_no ASC`,
    [routeId],
  )
  return rows.map((r) => routeStopRow(r))
}

export async function replaceStops(
  db: Pool,
  routeId: string,
  stops: { hubId: string; sequenceNo: number; estimatedArrivalMinutes?: number | null }[],
): Promise<RouteStop[]> {
  await db.execute<OkPacket>(`DELETE FROM route_stops WHERE route_id = ?`, [routeId])
  for (const stop of stops) {
    await db.execute<OkPacket>(
      `INSERT INTO route_stops (route_id, hub_id, sequence_no, estimated_arrival_minutes) VALUES (?, ?, ?, ?)`,
      [routeId, stop.hubId, stop.sequenceNo, stop.estimatedArrivalMinutes ?? null],
    )
  }
  return selectStops(db, routeId)
}
