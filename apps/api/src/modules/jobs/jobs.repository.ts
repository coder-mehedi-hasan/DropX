import type { DeliveryStatus, Job, ListParams, Parcel, ParcelItem, PickupStatus } from "@/db/models"
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
  deli_address_line: string | null
  deli_area_name: string | null
  deli_zone_name: string | null
  deli_city_name: string | null
  deli_landmark: string | null
  pick_address_line: string | null
  pick_area_name: string | null
  pick_zone_name: string | null
  pick_city_name: string | null
  pick_landmark: string | null
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

/*
 * The two structured address ends ride along from `parcel_addresses`, joined by
 * type so each end resolves to its own row (`uq_parcel_addresses_parcel_type`
 * guarantees at most one per type). A parcel booked before the migration has no
 * row, so the joins are LEFT and the structured fields decode to null — the
 * flat `d.delivery_address` snapshot remains the always-present fallback.
 */
const JOB_COLUMNS = `
  d.id AS delivery_id, d.attempt_no, d.status AS delivery_status, d.delivery_address,
  da.address_line AS deli_address_line, da.area_name AS deli_area_name,
  da.zone_name AS deli_zone_name, da.city_name AS deli_city_name, da.landmark AS deli_landmark,
  pa.address_line AS pick_address_line, pa.area_name AS pick_area_name,
  pa.zone_name AS pick_zone_name, pa.city_name AS pick_city_name, pa.landmark AS pick_landmark,
  d.failure_reason, d.recipient_name, d.recipient_phone,
  d.out_for_delivery_at, d.delivered_at,
  p.id AS parcel_id, p.tracking_number, p.status AS parcel_status, p.weight,
  p.cod_amount, p.payment_type, p.created_at
`

const JOB_JOINS = `
  LEFT JOIN parcel_addresses AS da ON da.parcel_id = p.id AND da.type = 'DELIVERY'
  LEFT JOIN parcel_addresses AS pa ON pa.parcel_id = p.id AND pa.type = 'PICKUP'
`

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function toDate(value: string | Date | null): Date | null {
  if (value === null) return null
  if (value instanceof Date) return value
  return new Date(`${value.replace(" ", "T")}Z`)
}

export function decodeJob(row: unknown): Job {
  const r = row as JobRow
  return {
    delivery: {
      id: String(r.delivery_id),
      attemptNo: r.attempt_no,
      status: r.delivery_status,
      address: r.delivery_address,
      addressLine: toStringOrNull(r.deli_address_line),
      areaName: toStringOrNull(r.deli_area_name),
      zoneName: toStringOrNull(r.deli_zone_name),
      cityName: toStringOrNull(r.deli_city_name),
      landmark: toStringOrNull(r.deli_landmark),
      failureReason: toStringOrNull(r.failure_reason),
      recipientName: toStringOrNull(r.recipient_name),
      recipientPhone: toStringOrNull(r.recipient_phone),
      outForDeliveryAt: toDate(r.out_for_delivery_at)?.toISOString() ?? null,
      deliveredAt: toDate(r.delivered_at)?.toISOString() ?? null,
    },
    pickup: {
      addressLine: toStringOrNull(r.pick_address_line),
      areaName: toStringOrNull(r.pick_area_name),
      zoneName: toStringOrNull(r.pick_zone_name),
      cityName: toStringOrNull(r.pick_city_name),
      landmark: toStringOrNull(r.pick_landmark),
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

export type RiderPickupJob = {
  pickupId: string
  pickupStatus: PickupStatus
  pickupAddress: string
  scheduledAt: string | null
  pickedUpAt: string | null
  failureReason: string | null
  parcelId: string
  trackingNumber: string
  parcelStatus: Parcel["status"]
  weight: string
  codAmount: string
  paymentType: Parcel["paymentType"]
  createdAt: string
}

const PICKUP_JOB_COLUMNS = `
  pk.id AS pickup_id, pk.status AS pickup_status, pk.pickup_address,
  pk.scheduled_at, pk.picked_up_at, pk.failure_reason,
  p.id AS parcel_id, p.tracking_number, p.status AS parcel_status,
  p.weight, p.cod_amount, p.payment_type, p.created_at
`

export function decodePickupJob(row: unknown): RiderPickupJob {
  const r = row as Record<string, unknown>
  return {
    pickupId: String(r.pickup_id),
    pickupStatus: r.pickup_status as PickupStatus,
    pickupAddress: String(r.pickup_address),
    scheduledAt: toDate(r.scheduled_at as string | Date | null)?.toISOString() ?? null,
    pickedUpAt: toDate(r.picked_up_at as string | Date | null)?.toISOString() ?? null,
    failureReason: toStringOrNull(r.failure_reason),
    parcelId: String(r.parcel_id),
    trackingNumber: String(r.tracking_number),
    parcelStatus: r.parcel_status as Parcel["status"],
    weight: String(r.weight),
    codAmount: String(r.cod_amount),
    paymentType: r.payment_type as Parcel["paymentType"],
    createdAt: toDate(r.created_at as string | Date)?.toISOString() ?? "",
  }
}

export async function listPickupJobsForRider(
  db: Pool | Connection,
  riderId: string,
  params: ListParams,
  status: PickupStatus | undefined,
): Promise<{ nodes: RiderPickupJob[]; totalCount: number }> {
  const clauses = ["pk.assigned_rider_id = ?"]
  const filterParams: unknown[] = [riderId]
  if (status) {
    if (status === "ASSIGNED") {
      // The rider's Assigned tab is the active pickup queue: a pickup remains
      // actionable after the rider starts it, until it is picked up or failed.
      clauses.push("pk.status IN ('ASSIGNED', 'IN_PROGRESS')")
    } else {
      clauses.push("pk.status = ?")
      filterParams.push(status)
    }
  }
  const where = `WHERE ${clauses.join(" AND ")}`
  const from = "FROM pickups AS pk INNER JOIN parcels AS p ON p.id = pk.parcel_id"
  const [countRows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count ${from} ${where}`,
    filterParams,
  )
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${PICKUP_JOB_COLUMNS} ${from} ${where} ORDER BY pk.created_at DESC, pk.id DESC LIMIT ? OFFSET ?`,
    [...filterParams, params.limit, params.offset],
  )
  return {
    nodes: rows.map((row) => decodePickupJob(row)),
    totalCount: Number(countRows[0]?.count ?? 0),
  }
}

export async function findPickupJobForRider(
  db: Pool | Connection,
  riderId: string,
  pickupId: string,
  forUpdate = false,
): Promise<RiderPickupJob | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${PICKUP_JOB_COLUMNS} FROM pickups AS pk INNER JOIN parcels AS p ON p.id = pk.parcel_id
     WHERE pk.assigned_rider_id = ? AND pk.id = ? LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [riderId, pickupId],
  )
  return rows[0] ? decodePickupJob(rows[0]) : null
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
  const pageSql = `SELECT ${JOB_COLUMNS} FROM deliveries AS d INNER JOIN parcels AS p ON p.id = d.parcel_id${JOB_JOINS}${where ? " " + where : ""} ORDER BY d.attempt_no DESC, d.id DESC LIMIT ? OFFSET ?`

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
    `SELECT ${JOB_COLUMNS} FROM deliveries AS d JOIN parcels AS p ON p.id = d.parcel_id${JOB_JOINS} WHERE d.rider_id = ? AND d.parcel_id = ? ORDER BY d.attempt_no DESC LIMIT 1`,
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
