import type { Connection, OkPacket, Pool } from "mysql2/promise"

import type { ListParams } from "@/db/models"
import { orderByClauseOf, pageOf, toDecimal, toUtcDate, whereClause } from "@/db/sql"
import type { RiderLocation } from "@dropx/types"

const RIDER_LOCATION_COLUMNS = `
  rl.id, rl.rider_id, rl.latitude, rl.longitude, rl.recorded_at
`

const RIDER_LOCATION_FROM = "rider_locations AS rl"

/**
 * Client sort key → SQL column expression.
 *
 * A client sends `recordedAt`; SQL knows `rl.recorded_at`. Comparing the two
 * directly always fails, so the sort silently falls back to the tiebreak and the
 * list looks merely unsorted rather than broken — which is how the zones,
 * vehicles and routes lists ended up ignoring `sortBy` entirely. The map is the
 * fix: one entry per sortable field, so a key that has no mapping is impossible
 * to write by accident.
 */
const RIDER_LOCATION_SORT_COLUMNS = {
  recordedAt: "rl.recorded_at",
} as const

const RIDER_LOCATION_TIEBREAK = "rl.id ASC"

function riderLocationRow(row: Record<string, unknown>): RiderLocation {
  return {
    id: String(row.id),
    riderId: String(row.rider_id),
    latitude: toDecimal(row.latitude),
    longitude: toDecimal(row.longitude),
    recordedAt: toUtcDate(row.recorded_at as string | Date).toISOString(),
  }
}

export type ListRiderLocationsFilter = {
  riderId?: string | undefined
}

export async function selectRiderLocations(
  db: Pool,
  params: ListParams,
  filter: ListRiderLocationsFilter,
): Promise<{ nodes: RiderLocation[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.riderId) {
    clauses.push("rl.rider_id = ?")
    filterParams.push(filter.riderId)
  }

  const where = whereClause(clauses)
  const sortColumn = params.sortBy
    ? (RIDER_LOCATION_SORT_COLUMNS as Record<string, string>)[params.sortBy]
    : undefined
  const orderBy = orderByClauseOf(sortColumn, params.sort, RIDER_LOCATION_TIEBREAK)

  return pageOf(db, {
    pageSql: `SELECT ${RIDER_LOCATION_COLUMNS} FROM ${RIDER_LOCATION_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM ${RIDER_LOCATION_FROM}${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: riderLocationRow,
  })
}

export async function insertRiderLocation(
  db: Pool | Connection,
  record: Omit<RiderLocation, "id">,
): Promise<string> {
  const sql = `INSERT INTO rider_locations (rider_id, latitude, longitude, recorded_at) VALUES (?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, [
    record.riderId,
    record.latitude,
    record.longitude,
    toMysqlDateTime(record.recordedAt),
  ])
  if (!result.insertId) throw new Error("Rider location insert returned no id")
  return String(result.insertId)
}

/**
 * `recorded_at` is a naive `DATETIME` and the pool reads those as UTC
 * (`timezone: "Z"`), so the ISO instant is stored in UTC with no zone shift. A
 * `DATETIME` has no fractional seconds either, so milliseconds are dropped.
 */
function toMysqlDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ")
}
