import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { Delivery, ListParams } from "@/db/models"
import type { Scope } from "@/shared/auth/auth-context"
import {
  escapeLike,
  orderByClauseOf,
  pageOf,
  toStringOrNull,
  toUtcDate,
  whereClause,
} from "@/db/sql"
import type { Id, ParcelStatus } from "@dropx/types"

import { applyScope } from "../parcels/parcels.repository"

const DELIVERY_COLUMNS = `
  d.id, d.parcel_id, d.hub_id, d.rider_id, d.attempt_no, d.delivery_address,
  d.assigned_at, d.out_for_delivery_at, d.delivered_at, d.status, d.failure_reason,
  d.recipient_name, d.recipient_phone, d.created_at, d.updated_at,
  p.tracking_number AS parcel_tracking_number,
  h.name AS hub_name, h.code AS hub_code,
  u.name AS rider_name, r.employee_code AS rider_employee_code
`

/**
 * A delivery is dispatched from the hub it departs — `d.hub_id` — so scoping
 * follows that hub directly, joined into the `scope_hub` alias `applyScope`
 * writes against. The parcel join is for the tracking number a dispatcher
 * reads; it is also how the search matches what a human says over the phone.
 */
const DELIVERY_FROM = `deliveries AS d
  JOIN parcels AS p ON p.id = d.parcel_id
  LEFT JOIN hubs AS h ON h.id = d.hub_id
  LEFT JOIN riders AS r ON r.id = d.rider_id
  LEFT JOIN users AS u ON u.id = r.user_id
  LEFT JOIN hubs AS scope_hub ON scope_hub.id = d.hub_id`

/**
 * Client sort key → SQL column expression. See the note in
 * `rider-locations.repository.ts`: an array allowlist holding SQL names never
 * matches the camelCase key a client sends, so `sortBy` silently does nothing.
 */
const DELIVERY_SORT_COLUMNS = {
  assignedAt: "d.assigned_at",
  deliveredAt: "d.delivered_at",
  status: "d.status",
  createdAt: "d.created_at",
} as const

const DELIVERY_TIEBREAK = "d.created_at DESC, d.id DESC"
const DELIVERY_SEARCH_COLUMNS = ["p.tracking_number", "h.name", "u.name", "r.employee_code"]

export type DeliveryRow = Delivery & {
  parcelTrackingNumber: string
  hubName: string
  hubCode: string
  riderName: string
  riderEmployeeCode: string
}

function deliveryRow(row: Record<string, unknown>): DeliveryRow {
  return {
    id: String(row.id),
    parcelId: String(row.parcel_id),
    hubId: String(row.hub_id),
    riderId: String(row.rider_id),
    attemptNo: Number(row.attempt_no),
    deliveryAddress: String(row.delivery_address),
    assignedAt: nullableDate(row.assigned_at),
    outForDeliveryAt: nullableDate(row.out_for_delivery_at),
    deliveredAt: nullableDate(row.delivered_at),
    status: row.status as Delivery["status"],
    failureReason: toStringOrNull(row.failure_reason),
    recipientName: toStringOrNull(row.recipient_name),
    recipientPhone: toStringOrNull(row.recipient_phone),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
    parcelTrackingNumber: String(row.parcel_tracking_number),
    hubName: String(row.hub_name),
    hubCode: String(row.hub_code),
    riderName: String(row.rider_name),
    riderEmployeeCode: String(row.rider_employee_code),
  }
}

function nullableDate(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return toUtcDate(value as string | Date).toISOString()
}

export type ListDeliveriesFilter = {
  status?: Delivery["status"] | undefined
  riderId?: Id | undefined
  hubId?: Id | undefined
  search?: string | undefined
}

function scopePredicate(scope: Scope): { text: string; params: unknown[] } | null {
  const clause = applyScope(scope)
  return clause.params.length > 0 ? clause : null
}

export async function selectDeliveries(
  db: Pool | Connection,
  scope: Scope,
  params: ListParams,
  filter: ListDeliveriesFilter,
): Promise<{ nodes: DeliveryRow[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  const scopeSql = scopePredicate(scope)
  if (scopeSql) {
    clauses.push(scopeSql.text)
    filterParams.push(...scopeSql.params)
  }

  if (filter.status) {
    clauses.push("d.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.riderId) {
    clauses.push("d.rider_id = ?")
    filterParams.push(filter.riderId)
  }
  if (filter.hubId) {
    clauses.push("d.hub_id = ?")
    filterParams.push(filter.hubId)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${DELIVERY_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of DELIVERY_SEARCH_COLUMNS) filterParams.push(like)
  }

  const where = whereClause(clauses)
  const sortColumn = params.sortBy
    ? (DELIVERY_SORT_COLUMNS as Record<string, string>)[params.sortBy]
    : undefined
  const orderBy = orderByClauseOf(sortColumn, params.sort, DELIVERY_TIEBREAK)

  return pageOf(db, {
    pageSql: `SELECT ${DELIVERY_COLUMNS} FROM ${DELIVERY_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM ${DELIVERY_FROM}${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: deliveryRow,
  })
}

export async function selectDelivery(
  db: Pool | Connection,
  scope: Scope,
  deliveryId: string,
  options: { forUpdate?: boolean } = {},
): Promise<DeliveryRow | null> {
  const clauses = ["d.id = ?"]
  const params: unknown[] = [deliveryId]
  const scoped = scopePredicate(scope)
  if (scoped) {
    clauses.push(scoped.text)
    params.push(...scoped.params)
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${DELIVERY_COLUMNS} FROM ${DELIVERY_FROM} WHERE ${clauses.join(" AND ")} LIMIT 1${
      options.forUpdate ? " FOR UPDATE" : ""
    }`,
    params,
  )
  return rows[0] ? deliveryRow(rows[0]) : null
}

/**
 * An open attempt is one that has not reached a terminal status — `ASSIGNED`
 * (dispatched, rider not yet out) or `OUT_FOR_DELIVERY` (rider on the
 * parcel). Only one may exist per parcel; the invariant is enforced on
 * create, and mirrored on pickups as `countOpenPickups`.
 */
const OPEN_DELIVERY_STATUSES = ["ASSIGNED", "OUT_FOR_DELIVERY"] as const

export async function countOpenAttempts(db: Pool | Connection, parcelId: string): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM deliveries
     WHERE parcel_id = ? AND status IN (${OPEN_DELIVERY_STATUSES.map(() => "?").join(", ")})`,
    [parcelId, ...OPEN_DELIVERY_STATUSES],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function nextAttemptNo(db: Pool | Connection, parcelId: string): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(attempt_no), 0) + 1 AS next FROM deliveries WHERE parcel_id = ?`,
    [parcelId],
  )
  return Number(rows[0]?.next ?? 1)
}

/**
 * The hub a parcel waits at, which is where its delivery attempt departs
 * from. One definition — a delivery's hub is its parcel's hub — read from the
 * parcel row inside the create transaction, rather than taken from a client
 * field that could disagree with the parcel.
 */
export async function parcelDispatchHub(
  db: Pool | Connection,
  scope: Scope,
  parcelId: string,
): Promise<{ hubId: string; status: ParcelStatus } | null> {
  const clauses = ["p.id = ?"]
  const params: unknown[] = [parcelId]
  const scoped = scopePredicate(scope)
  if (scoped) {
    clauses.push(scoped.text)
    params.push(...scoped.params)
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COALESCE(p.current_hub_id, p.destination_hub_id) AS hub_id, p.status
       FROM parcels AS p
       LEFT JOIN hubs AS scope_hub ON scope_hub.id = COALESCE(p.current_hub_id, p.destination_hub_id)
      WHERE ${clauses.join(" AND ")} LIMIT 1`,
    params,
  )
  return rows[0] ? { hubId: String(rows[0].hub_id), status: rows[0].status as ParcelStatus } : null
}

export async function insertDelivery(
  db: Pool | Connection,
  record: {
    parcelId: Id
    hubId: Id
    riderId: Id
    attemptNo: number
    deliveryAddress: string
  },
): Promise<string> {
  const sql = `INSERT INTO deliveries (parcel_id, hub_id, rider_id, attempt_no, delivery_address, assigned_at, status) VALUES (?, ?, ?, ?, ?, NOW(), 'ASSIGNED')`
  const [result] = await db.execute<OkPacket>(sql, [
    record.parcelId,
    record.hubId,
    record.riderId,
    record.attemptNo,
    record.deliveryAddress,
  ])
  if (!result.insertId) throw new Error("Delivery insert returned no id")
  return String(result.insertId)
}

/**
 * Reassignment swaps the rider on the same attempt: status stays `ASSIGNED`,
 * `assigned_at` is re-stamped (`NOW()` — a new decision by dispatch). The
 * scope rides along on the UPDATE through an explicit joined hub row rather
 * than being checked by a prior read: two statements is a race.
 */
export async function reassignDeliveryRow(
  db: Pool | Connection,
  scope: Scope,
  deliveryId: string,
  riderId: Id,
): Promise<number> {
  const params: (string | number | null)[] = [riderId, deliveryId]
  let sql = `UPDATE deliveries AS d
    LEFT JOIN hubs AS scope_hub ON scope_hub.id = d.hub_id
    SET d.rider_id = ?, d.assigned_at = NOW()
    WHERE d.id = ? AND d.status = 'ASSIGNED'`
  const scoped = scopePredicate(scope)
  if (scoped) {
    sql += ` AND ${scoped.text}`
    params.push(...(scoped.params as (string | number | null)[]))
  }
  const [result] = await db.execute<OkPacket>(sql, params)
  return result.affectedRows
}

/**
 * The status write. `out_for_delivery_at` and `delivered_at` are stamped by
 * the database in the same statement, so a timestamp and its status can never
 * disagree, and a stale failure reason is cleared the same way as a pickup's.
 * The scope join mirrors `reassignDeliveryRow` — a bare UPDATE with a
 * `scope_hub` predicate has no such alias and fails for scoped callers.
 */
export async function updateDeliveryStatusRow(
  db: Pool | Connection,
  scope: Scope,
  deliveryId: string,
  status: Delivery["status"],
  failureReason: string | null,
): Promise<number> {
  const params: (string | number | null)[] = [status]
  const assignments = ["status = ?"]

  if (status === "OUT_FOR_DELIVERY") assignments.push("out_for_delivery_at = NOW()")
  if (status === "DELIVERED") assignments.push("delivered_at = NOW()")

  if (status === "FAILED" || status === "CANCELLED") {
    assignments.push("failure_reason = ?")
    params.push(failureReason)
  } else {
    // Leaving a stale reason on a retried attempt would read as a live failure.
    assignments.push("failure_reason = NULL")
  }

  params.push(deliveryId)
  let sql = `UPDATE deliveries AS d
    LEFT JOIN hubs AS scope_hub ON scope_hub.id = d.hub_id
    SET ${assignments.map((a) => "d." + a).join(", ")}
    WHERE d.id = ?`
  const scoped = scopePredicate(scope)
  if (scoped) {
    sql += ` AND ${scoped.text}`
    params.push(...(scoped.params as (string | number | null)[]))
  }
  const [result] = await db.execute<OkPacket>(sql, params)
  return result.affectedRows
}
