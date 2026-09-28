import {
  QueryBuilder,
  TABLES,
  toId,
  toStringOrNull,
  type Delivery,
  type DeliveryStatus,
  type Executor,
  type Id,
  type ListParams,
  type Parcel,
  type ParcelItem,
} from "@dropx/db"

import { decodeItem, type ParcelItemRow } from "../parcels/parcels.repository"

/**
 * Rider-scoped persistence.
 *
 * Every query filters on `deliveries.rider_id = ?` (or `pickups.assigned_rider_id`).
 * There is no scope argument to pass and none to forget: a rider only ever sees
 * work assigned to them, so the ownership predicate is not optional here the way
 * it is for branch/hub scope in `parcels.repository`.
 */

type JobRow = {
  delivery_id: string
  attempt_no: number
  delivery_status: DeliveryStatus
  delivery_address: string
  failure_reason: string | null
  recipient_name: string | null
  recipient_phone: string | null
  out_for_delivery_at: string | null
  delivered_at: string | null
  parcel_id: string
  tracking_number: string
  parcel_status: Parcel["status"]
  weight: string
  cod_amount: string
  payment_type: Parcel["paymentType"]
  created_at: string
}

export type Job = {
  delivery: {
    id: Id
    attemptNo: number
    status: DeliveryStatus
    address: string
    failureReason: string | null
    recipientName: string | null
    recipientPhone: string | null
    outForDeliveryAt: Date | null
    deliveredAt: Date | null
  }
  parcel: {
    id: Id
    trackingNumber: string
    status: Parcel["status"]
    weight: number
    codAmount: number
    paymentType: Parcel["paymentType"]
    createdAt: Date
  }
}

const JOB_COLUMNS = `
  d.id AS delivery_id, d.attempt_no, d.status AS delivery_status, d.delivery_address,
  d.failure_reason, d.recipient_name, d.recipient_phone,
  d.out_for_delivery_at, d.delivered_at,
  p.id AS parcel_id, p.tracking_number, p.status AS parcel_status, p.weight,
  p.cod_amount, p.payment_type, p.created_at
`

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(`${value.replace(" ", "T")}Z`)
}

export function decodeJob(row: JobRow): Job {
  return {
    delivery: {
      id: toId(row.delivery_id, "deliveryId"),
      attemptNo: row.attempt_no,
      status: row.delivery_status,
      address: row.delivery_address,
      failureReason: toStringOrNull(row.failure_reason),
      recipientName: toStringOrNull(row.recipient_name),
      recipientPhone: toStringOrNull(row.recipient_phone),
      outForDeliveryAt: toDate(row.out_for_delivery_at),
      deliveredAt: toDate(row.delivered_at),
    },
    parcel: {
      id: toId(row.parcel_id, "parcelId"),
      trackingNumber: row.tracking_number,
      status: row.parcel_status,
      weight: Number(row.weight),
      codAmount: Number(row.cod_amount),
      paymentType: row.payment_type,
      createdAt: toDate(row.created_at) ?? new Date(0),
    },
  }
}

/** The rider's own deliveries for one status, newest first. */
export async function listJobsForRider(
  db: Executor,
  riderId: Id,
  params: ListParams,
  status: DeliveryStatus | undefined,
  search: string | undefined,
): Promise<{ nodes: Job[]; totalCount: number }> {
  const builder = new QueryBuilder()
    .select(JOB_COLUMNS)
    .from(TABLES.deliveries, "d")
    .innerJoin(TABLES.parcels, "p.id = d.parcel_id", "p")
    .where("d.rider_id = ?", riderId)
    // A falsy condition is skipped by the builder; binding an absent filter as
    // NULL would emit `d.status = NULL` and silently return no rows at all.
    .where(status ? "d.status = ?" : false, status)

  if (search) {
    builder.whereSearch(search, ["p.tracking_number", "d.recipient_name", "d.recipient_phone"])
  }

  // `attempt_no DESC` keeps the newest attempt first when a parcel has been
  // retried, so a failed job does not linger above its replacement.
  builder.orderBy([
    { column: "d.attempt_no", direction: "desc" },
    { column: "d.id", direction: "desc" },
  ])

  const countQuery = builder.buildCount()
  const pageQuery = builder.limit(params.limit).offset(params.offset).build()

  const [totalCount, rows] = await Promise.all([
    db.count(countQuery.sql, countQuery.params),
    db.query<JobRow>(pageQuery.sql, pageQuery.params),
  ])

  return { nodes: rows.rows.map(decodeJob), totalCount }
}

export async function findJobForRider(
  db: Executor,
  riderId: Id,
  parcelId: Id,
): Promise<Job | null> {
  // The rider may hold several attempts on one parcel; the latest wins, and the
  // historical ones stay visible on the parcel timeline in the console.
  const row = await db.queryOne<JobRow>(
    `SELECT ${JOB_COLUMNS}
       FROM ${TABLES.deliveries} d
       JOIN ${TABLES.parcels} p ON p.id = d.parcel_id
      WHERE d.rider_id = ? AND d.parcel_id = ?
      ORDER BY d.attempt_no DESC
      LIMIT 1`,
    [riderId, parcelId],
  )

  return row ? decodeJob(row) : null
}

export async function listJobItems(db: Executor, parcelId: Id): Promise<ParcelItem[]> {
  const rows = await db.query<ParcelItemRow>(
    `SELECT id, parcel_id, name, description, quantity, unit_price, total_price, created_at
       FROM ${TABLES.parcelItems}
      WHERE parcel_id = ?
      ORDER BY id`,
    [parcelId],
  )

  return rows.rows.map((row) => decodeItem(row))
}

type UpdateJobRow = {
  id: string
  attempt_no: number
  status: DeliveryStatus
  parcel_id: string
  status_before: Parcel["status"]
}

/** The open attempt for this rider — `FOR UPDATE` so two devices cannot both claim it. */
export async function findOpenAttemptForUpdate(
  db: Executor,
  riderId: Id,
  parcelId: Id,
): Promise<UpdateJobRow | null> {
  return db.queryOne<UpdateJobRow>(
    `SELECT d.id, d.attempt_no, d.status, d.parcel_id, p.status AS status_before
       FROM ${TABLES.deliveries} d
       JOIN ${TABLES.parcels} p ON p.id = d.parcel_id
      WHERE d.rider_id = ? AND d.parcel_id = ?
        AND d.status IN ('ASSIGNED', 'OUT_FOR_DELIVERY')
      ORDER BY d.attempt_no DESC
      LIMIT 1
      FOR UPDATE`,
    [riderId, parcelId],
  )
}

/**
 * Closes the attempt.
 *
 * `attempt_no = attempt_no - 1` on a non-terminal row is what keeps the
 * `uq_deliveries_parcel_attempt` unique index satisfied when dispatch opens a
 * retry: the previous attempt is released rather than overwritten.
 */
export async function closeAttempt(
  db: Executor,
  deliveryId: Id,
  attemptNo: number,
  status: DeliveryStatus,
  reason: string | null,
): Promise<void> {
  await db.execute(
    `UPDATE ${TABLES.deliveries}
        SET status = ?,
            failure_reason = COALESCE(?, failure_reason),
            out_for_delivery_at = CASE WHEN ? = 'OUT_FOR_DELIVERY' THEN NOW() ELSE out_for_delivery_at END,
            delivered_at = CASE WHEN ? = 'DELIVERED' THEN NOW() ELSE delivered_at END
      WHERE id = ? AND attempt_no = ?`,
    [status, reason, status, status, deliveryId, attemptNo],
  )
}

export type { Delivery }
