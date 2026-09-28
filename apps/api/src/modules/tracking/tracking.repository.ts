import {
  TABLES,
  toDate,
  toDecimal,
  toId,
  toNullableDecimal,
  toStringOrNull,
  type Database,
  type HubRef,
  type ParcelEventType,
  type ParcelStatus,
  type ParcelType,
  type PaymentType,
} from "@dropx/db"

/**
 * Read-only queries for public tracking.
 *
 * The projection is deliberately narrow: it selects hub codes and event
 * descriptions, never sender/receiver identity. Public tracking must not leak
 * unrelated customer PII.
 */

type TrackingRow = {
  id: string
  tracking_number: string
  parcel_type: ParcelType
  payment_type: PaymentType
  status: ParcelStatus
  weight: string
  cod_amount: string
  delivered_at: string | null
  origin_code: string
  origin_name: string
  origin_district: string | null
  destination_code: string
  destination_name: string
  destination_district: string | null
  current_code: string | null
  current_name: string | null
  current_district: string | null
}

type EventRow = {
  event_type: ParcelEventType
  description: string | null
  created_at: string
  hub_name: string | null
}

const TRACKING_SELECT = `
  SELECT p.id, p.tracking_number, p.parcel_type, p.payment_type, p.status,
         p.weight, p.cod_amount,
         (SELECT MAX(d.delivered_at) FROM ${TABLES.deliveries} d WHERE d.parcel_id = p.id AND d.status = 'DELIVERED') AS delivered_at,
         origin.code AS origin_code, origin.name AS origin_name, origin.district AS origin_district,
         dest.code  AS destination_code, dest.name AS destination_name, dest.district AS destination_district,
         current.code AS current_code, current.name AS current_name, current.district AS current_district
    FROM ${TABLES.parcels} p
    JOIN ${TABLES.hubs} origin ON origin.id = p.origin_hub_id
    JOIN ${TABLES.hubs} dest   ON dest.id   = p.destination_hub_id
    LEFT JOIN ${TABLES.hubs} current ON current.id = p.current_hub_id
`

export const trackingRepository = {
  async findByTrackingNumber(db: Database, trackingNumber: string): Promise<TrackingRow | null> {
    return db.queryOne<TrackingRow>(`${TRACKING_SELECT} WHERE p.tracking_number = ? LIMIT 1`, [
      trackingNumber,
    ])
  },

  async findEvents(db: Database, parcelId: string): Promise<EventRow[]> {
    const result = await db.query<EventRow>(
      `SELECT e.event_type, e.description, e.created_at, h.name AS hub_name
         FROM ${TABLES.parcelEvents} e
         LEFT JOIN ${TABLES.hubs} h ON h.id = e.hub_id
        WHERE e.parcel_id = ?
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 100`,
      [parcelId],
    )
    return result.rows
  },
}

export type { TrackingRow, EventRow }

export function toHubRef(
  code: string | null,
  name: string | null,
  district: string | null,
): HubRef | null {
  if (!code || !name) return null
  return { code, name, district: toStringOrNull(district) }
}

export function decodeTrackingRow(row: TrackingRow) {
  return {
    parcelId: toId(row.id),
    trackingNumber: row.tracking_number,
    status: row.status,
    parcelType: row.parcel_type,
    paymentType: row.payment_type,
    weight: toDecimal(row.weight),
    codAmount: toDecimal(row.cod_amount),
    deliveredAt: toDate(row.delivered_at),
    originHub: toHubRef(row.origin_code, row.origin_name, row.origin_district)!,
    destinationHub: toHubRef(row.destination_code, row.destination_name, row.destination_district)!,
    currentHub: toHubRef(row.current_code, row.current_name, row.current_district),
  }
}

export function decodeEventRow(row: EventRow) {
  return {
    eventType: row.event_type,
    description: toStringOrNull(row.description),
    location: toStringOrNull(row.hub_name),
    createdAt: toDate(row.created_at) ?? new Date(0),
  }
}

export { toNullableDecimal }
