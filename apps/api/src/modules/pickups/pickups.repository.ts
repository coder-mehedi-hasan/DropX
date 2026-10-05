import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { ListParams, Pickup } from "@/db/models"
import type { Scope } from "@/shared/auth/auth-context"
import {
  escapeLike,
  orderByClauseOf,
  pageOf,
  toStringOrNull,
  toUtcDate,
  whereClause,
} from "@/db/sql"
import type { Id } from "@dropx/types"

import { applyScope } from "../parcels/parcels.repository"

const PICKUP_COLUMNS = `
  pk.id, pk.parcel_id, pk.requested_by, pk.assigned_rider_id, pk.pickup_address,
  pk.scheduled_at, pk.picked_up_at, pk.status, pk.failure_reason,
  pk.created_at, pk.updated_at
`

/**
 * A pickup owns no hub of its own — it is a collection against one parcel, and
 * the parcel is what carries geography. So scoping joins the parcel and reuses
 * the same `COALESCE(current_hub_id, destination_hub_id)` rule the parcels
 * repository uses, rather than inventing a second definition of "which hub is
 * this parcel at". Two definitions would drift, and the loser would be the scope
 * check, which is the one thing that must not be lenient.
 */
const PICKUP_SCOPE_JOIN =
  "LEFT JOIN parcels AS p ON p.id = pk.parcel_id LEFT JOIN hubs AS scope_hub ON scope_hub.id = COALESCE(p.current_hub_id, p.destination_hub_id)"

const PICKUP_FROM = `pickups AS pk ${PICKUP_SCOPE_JOIN}`

/**
 * Client sort key → SQL column expression. See the note in
 * `rider-locations.repository.ts`: an array allowlist holding SQL names never
 * matches the camelCase key a client sends, so `sortBy` silently does nothing.
 */
const PICKUP_SORT_COLUMNS = {
  scheduledAt: "pk.scheduled_at",
  status: "pk.status",
  createdAt: "pk.created_at",
} as const

const PICKUP_TIEBREAK = "pk.created_at DESC, pk.id DESC"
const PICKUP_SEARCH_COLUMNS = ["pk.pickup_address", "p.tracking_number"]

function pickupRow(row: Record<string, unknown>): Pickup {
  return {
    id: String(row.id),
    parcelId: String(row.parcel_id),
    requestedBy: toStringOrNull(row.requested_by),
    assignedRiderId: toStringOrNull(row.assigned_rider_id),
    pickupAddress: String(row.pickup_address),
    scheduledAt: nullableDate(row.scheduled_at),
    pickedUpAt: nullableDate(row.picked_up_at),
    status: row.status as Pickup["status"],
    failureReason: toStringOrNull(row.failure_reason),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

function nullableDate(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return toUtcDate(value as string | Date).toISOString()
}

export type ListPickupsFilter = {
  status?: Pickup["status"] | undefined
  riderId?: Id | undefined
  hubId?: Id | undefined
  search?: string | undefined
}

/**
 * The scope predicate for this module, wrapped so callers can push it into a
 * `WHERE` the same way they push a filter. It is `applyScope` from the parcels
 * repository rather than a second copy: the rule "a pickup is at whatever hub
 * its parcel is at" has exactly one definition, and a hand-rolled variant here
 * would be free to drift out of step with it.
 */
function scopePredicate(scope: Scope): { text: string; params: unknown[] } | null {
  const clause = applyScope(scope)
  return clause.params.length > 0 ? clause : null
}

export async function selectPickups(
  db: Pool | Connection,
  scope: Scope,
  params: ListParams,
  filter: ListPickupsFilter,
): Promise<{ nodes: Pickup[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  const scopeSql = scopePredicate(scope)
  if (scopeSql) {
    clauses.push(scopeSql.text)
    filterParams.push(...scopeSql.params)
  }

  if (filter.status) {
    clauses.push("pk.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.riderId) {
    clauses.push("pk.assigned_rider_id = ?")
    filterParams.push(filter.riderId)
  }
  if (filter.hubId) {
    clauses.push("COALESCE(p.current_hub_id, p.destination_hub_id) = ?")
    filterParams.push(filter.hubId)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${PICKUP_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of PICKUP_SEARCH_COLUMNS) filterParams.push(like)
  }

  const where = whereClause(clauses)
  const sortColumn = params.sortBy
    ? (PICKUP_SORT_COLUMNS as Record<string, string>)[params.sortBy]
    : undefined
  const orderBy = orderByClauseOf(sortColumn, params.sort, PICKUP_TIEBREAK)

  return pageOf(db, {
    pageSql: `SELECT ${PICKUP_COLUMNS} FROM ${PICKUP_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM ${PICKUP_FROM}${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: pickupRow,
  })
}

/**
 * `db` is `Pool | Connection` throughout this file so the same read serves both a
 * request and a transaction — a `FOR UPDATE` variant of a `Pool`-only read would
 * be a second implementation of the same query, and the two would drift.
 */
export async function selectPickup(
  db: Pool | Connection,
  scope: Scope,
  pickupId: string,
  options: { forUpdate?: boolean } = {},
): Promise<Pickup | null> {
  const clauses = ["pk.id = ?"]
  const params: unknown[] = [pickupId]
  const scoped = scopePredicate(scope)
  if (scoped) {
    clauses.push(scoped.text)
    params.push(...scoped.params)
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${PICKUP_COLUMNS} FROM ${PICKUP_FROM} WHERE ${clauses.join(" AND ")} LIMIT 1${
      options.forUpdate ? " FOR UPDATE" : ""
    }`,
    params,
  )
  return rows[0] ? pickupRow(rows[0]) : null
}

/**
 * Locks the parcel row the pickup will belong to, in scope.
 *
 * `reference` is matched against **either** the id or the tracking number. That is
 * not leniency for its own sake: the id is never shown to a human anywhere, while
 * the tracking number is the only string a customer can read out over the phone.
 * Accepting a field that callers cannot possibly know would make the whole create
 * path unusable, and a UI that hides raw ids in favour of names would have to
 * invent a lookup to compensate.
 *
 * The lock exists to serialise concurrent creates rather than to read anything:
 * two dispatchers raising a collection for the same parcel at the same moment
 * would each pass an "is there already an open pickup?" check and both insert.
 * Locking the shared parent row makes the second one wait, then see the first.
 */
export async function lockScopedParcelForUpdate(
  db: Pool | Connection,
  scope: Scope,
  reference: string,
): Promise<string | null> {
  const clauses = ["(p.id = ? OR p.tracking_number = ?)"]
  const params: unknown[] = [reference, reference]
  const scoped = scopePredicate(scope)
  if (scoped) {
    clauses.push(scoped.text)
    params.push(...scoped.params)
  }

  // The `scope_hub` alias is what `applyScope` writes against, so this joins the
  // same way the parcels repository does rather than restating the condition.
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.id FROM parcels AS p
     LEFT JOIN hubs AS scope_hub ON scope_hub.id = COALESCE(p.current_hub_id, p.destination_hub_id)
     WHERE ${clauses.join(" AND ")} LIMIT 1 FOR UPDATE`,
    params,
  )
  return rows[0] ? String(rows[0].id) : null
}

/**
 * An open pickup is one that has not reached a terminal status. A parcel can
 * have many of these over its life — a failed collection is retried by opening
 * another — but only one at a time, which is the invariant `createPickup`
 * enforces. Mirrors the single-open-attempt rule on `deliveries`.
 */
const OPEN_PICKUP_STATUSES = ["REQUESTED", "ASSIGNED", "IN_PROGRESS"] as const

export async function countOpenPickups(db: Pool | Connection, parcelId: string): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM pickups
     WHERE parcel_id = ? AND status IN (${OPEN_PICKUP_STATUSES.map(() => "?").join(", ")})`,
    [parcelId, ...OPEN_PICKUP_STATUSES],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function insertPickup(
  db: Pool | Connection,
  record: {
    parcelId: Id
    requestedBy: Id | null
    pickupAddress: string
    scheduledAt: string | null
    status: Pickup["status"]
  },
): Promise<string> {
  const sql = `INSERT INTO pickups (parcel_id, requested_by, pickup_address, scheduled_at, status) VALUES (?, ?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, [
    record.parcelId,
    record.requestedBy,
    record.pickupAddress,
    record.scheduledAt,
    record.status,
  ])
  if (!result.insertId) throw new Error("Pickup insert returned no id")
  return String(result.insertId)
}

/**
 * Assigning a rider. The status change is applied in the same statement rather
 * than left to a second call, so a pickup cannot be left assigned but still
 * reading `REQUESTED` if a client sends one and not the other.
 *
 * `NOW()` and not a passed instant: this is a decision made now by a human at a
 * desk, unlike `scheduled_at`, which is the time they intend to arrive.
 */
export async function assignPickupRow(
  db: Pool | Connection,
  pickupId: string,
  riderId: Id,
  scheduledAt: string | null,
): Promise<void> {
  await db.execute<OkPacket>(
    `UPDATE pickups SET assigned_rider_id = ?, scheduled_at = ?, status = 'ASSIGNED' WHERE id = ?`,
    [riderId, scheduledAt, pickupId],
  )
}

/**
 * The status write. `picked_up_at` is stamped by the database in the same
 * statement when the status is `PICKED_UP`, so the timestamp and the status can
 * never disagree, and so it reflects the server's clock rather than a client's.
 *
 * The scope predicate rides along on the UPDATE rather than being checked by a
 * prior read: two statements is a race, and the caller here already holds a
 * locked row inside the transaction.
 */
export async function updatePickupStatusRow(
  db: Pool | Connection,
  scope: Scope,
  pickupId: string,
  status: Pickup["status"],
  failureReason: string | null,
): Promise<number> {
  const params: (string | number | null)[] = [status]
  const assignments = ["status = ?"]

  if (status === "PICKED_UP") assignments.push("picked_up_at = NOW()")

  if (status === "FAILED" || status === "CANCELLED") {
    assignments.push("failure_reason = ?")
    params.push(failureReason)
  } else {
    // Leaving a stale reason on a retried pickup would read as a live failure.
    assignments.push("failure_reason = NULL")
  }

  if (status === "REQUESTED") {
    // Unassigning is expressed as a move back to REQUESTED, so the rider column
    // is cleared with it rather than left pointing at someone who no longer owns
    // the work.
    assignments.push("assigned_rider_id = NULL")
  }

  params.push(pickupId)
  let sql = `UPDATE pickups SET ${assignments.join(", ")} WHERE id = ?`

  const scoped = scopePredicate(scope)
  if (scoped) {
    sql += ` AND ${scoped.text}`
    params.push(...(scoped.params as (string | number | null)[]))
  }

  const [result] = await db.execute<OkPacket>(sql, params)
  return result.affectedRows
}
