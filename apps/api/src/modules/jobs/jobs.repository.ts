import type { DeliveryStatus, Job, ListParams, Parcel, ParcelItem } from "@/db/models"
import { decodeItem, type ParcelItemRow } from "@/modules/parcels/parcels.repository"
import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

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

const JOB_COLUMNS = `
  d.id AS delivery_id, d.attempt_no, d.status AS delivery_status, d.delivery_address,
  d.failure_reason, d.recipient_name, d.recipient_phone,
  d.out_for_delivery_at, d.delivered_at,
  p.id AS parcel_id, p.tracking_number, p.status AS parcel_status, p.weight,
  p.cod_amount, p.payment_type, p.created_at
`

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(`${value.replace(" ", "T")}Z`)
}

export function decodeJob(row: unknown): Job {
  const r = row as JobRow
  return {
    delivery: {
      id: String(r.delivery_id),
      attemptNo: r.attempt_no,
      status: r.delivery_status,
      address: r.delivery_address,
      failureReason: toStringOrNull(r.failure_reason),
      recipientName: toStringOrNull(r.recipient_name),
      recipientPhone: toStringOrNull(r.recipient_phone),
      outForDeliveryAt: toDate(r.out_for_delivery_at)?.toISOString() ?? null,
      deliveredAt: toDate(r.delivered_at)?.toISOString() ?? null,
    },
    parcel: {
      id: String(r.parcel_id),
      trackingNumber: r.tracking_number,
      status: r.parcel_status,
      weight: Number(r.weight),
      codAmount: Number(r.cod_amount),
      paymentType: r.payment_type,
      createdAt: toDate(r.created_at)?.toISOString() ?? "",
    },
  }
}

export function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

/** The rider's own deliveries for one status, newest first. */
async function pageJobRows<T>(
  db: Pool | Connection,
  sql: string,
  params: unknown[],
  countSql: string,
  countParams: unknown[],
  decode: (row: unknown) => T,
): Promise<{ nodes: T[]; totalCount: number }> {
  const [countRows] = await db.query<RowDataPacket[]>(countSql, countParams)
  const [rows] = await db.query<RowDataPacket[]>(sql, params)
  const countRow = countRows[0]
  const totalCount = countRow?.count == null ? 0 : Number(countRow.count)
  return { nodes: rows.map((row) => decode(row as JobRow)), totalCount }
}

export async function listJobsForRider(
  db: Pool | Connection,
  riderId: string,
  params: ListParams,
  status: DeliveryStatus | undefined,
  search: string | undefined,
): Promise<{ nodes: Job[]; totalCount: number }> {
  const clauses: { sql: string; params: unknown[] }[] = [
    { sql: "d.rider_id = ?", params: [riderId] },
  ]
  if (status) {
    clauses.push({ sql: "d.status = ?", params: [status] })
  }
  if (search) {
    const like = `%${escapeLike(search)}%`
    clauses.push({
      sql: `(${["p.tracking_number", "d.recipient_name", "d.recipient_phone"]
        .map((c) => `${c} LIKE ?`)
        .join(" OR ")})`,
      params: [like, like, like],
    })
  }
  const where = clauses.length ? `WHERE (${clauses.map((c) => c.sql).join(") AND (")})` : ""
  const whereParams = clauses.flatMap((c) => c.params)

  const countSql = `SELECT COUNT(*) AS count FROM deliveries AS d INNER JOIN parcels AS p ON p.id = d.parcel_id${where ? " " + where : ""}`
  const pageSql = `SELECT ${JOB_COLUMNS} FROM deliveries AS d INNER JOIN parcels AS p ON p.id = d.parcel_id${where ? " " + where : ""} ORDER BY d.attempt_no DESC, d.id DESC LIMIT ? OFFSET ?`

  return pageJobRows(
    db,
    pageSql,
    [...whereParams, params.limit, params.offset],
    countSql,
    whereParams,
    decodeJob,
  )
}

export async function findJobForRider(
  db: Pool | Connection,
  riderId: string,
  parcelId: string,
): Promise<Job | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${JOB_COLUMNS} FROM deliveries AS d JOIN parcels AS p ON p.id = d.parcel_id WHERE d.rider_id = ? AND d.parcel_id = ? ORDER BY d.attempt_no DESC LIMIT 1`,
    [riderId, parcelId],
  )
  return rows[0] ? decodeJob(rows[0] as JobRow) : null
}

export async function listJobItems(db: Pool | Connection, parcelId: string): Promise<ParcelItem[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, parcel_id, name, description, quantity, unit_price, total_price, created_at
       FROM parcel_items
      WHERE parcel_id = ?
      ORDER BY id`,
    [parcelId],
  )
  return (rows as ParcelItemRow[]).map(decodeItem)
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
  db: Pool | Connection,
  riderId: string,
  parcelId: string,
): Promise<UpdateJobRow | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT d.id, d.attempt_no, d.status, d.parcel_id, p.status AS status_before
       FROM deliveries AS d
       JOIN parcels AS p ON p.id = d.parcel_id
      WHERE d.rider_id = ? AND d.parcel_id = ?
        AND d.status IN ('ASSIGNED', 'OUT_FOR_DELIVERY')
      ORDER BY d.attempt_no DESC
      LIMIT 1
      FOR UPDATE`,
    [riderId, parcelId],
  )
  return rows[0] as UpdateJobRow | null
}

/**
 * Closes the attempt.
 *
 * `attempt_no = attempt_no - 1` on a non-terminal row is what keeps the
 * `uq_deliveries_parcel_attempt` unique index satisfied when dispatch opens a
 * retry: the previous attempt is released rather than overwritten.
 */
export async function closeAttempt(
  db: Pool | Connection,
  deliveryId: string,
  attemptNo: number,
  status: DeliveryStatus,
  reason: string | null,
): Promise<void> {
  await db.execute<OkPacket>(
    `UPDATE deliveries
        SET status = ?,
            failure_reason = COALESCE(?, failure_reason),
            out_for_delivery_at = CASE WHEN ? = 'OUT_FOR_DELIVERY' THEN NOW() ELSE out_for_delivery_at END,
            delivered_at = CASE WHEN ? = 'DELIVERED' THEN NOW() ELSE delivered_at END
      WHERE id = ? AND attempt_no = ?`,
    [status, reason, status, status, deliveryId, attemptNo],
  )
}
