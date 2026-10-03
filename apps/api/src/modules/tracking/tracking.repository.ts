import type { Pool, RowDataPacket } from "mysql2/promise"
import type { HubRef, ParcelEventType, ParcelStatus, ParcelType, PaymentType } from "@/db/models.ts"

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
         (SELECT MAX(d.delivered_at) FROM deliveries d WHERE d.parcel_id = p.id AND d.status = 'DELIVERED') AS delivered_at,
         origin.code AS origin_code, origin.name AS origin_name, origin.district AS origin_district,
         dest.code  AS destination_code, dest.name AS destination_name, dest.district AS destination_district,
         current.code AS current_code, current.name AS current_name, current.district AS current_district
    FROM parcels p
    JOIN hubs origin ON origin.id = p.origin_hub_id
    JOIN hubs dest   ON dest.id   = p.destination_hub_id
    LEFT JOIN hubs current ON current.id = p.current_hub_id
`



function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === "number") return new Date(value)
  if (typeof value === "string") {
    const normalised = value.includes("T") ? value : value.replace(" ", "T")
    const parsed = new Date(normalised.endsWith("Z") ? normalised : `${normalised}Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function toDecimal(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}
export const trackingRepository = {
  async findByTrackingNumber(db: Pool, trackingNumber: string): Promise<TrackingRow | null> {
    const [rows] = await db.query<RowDataPacket[]>(`${TRACKING_SELECT} WHERE p.tracking_number = ? LIMIT 1`, [
      trackingNumber,
    ])
    return rows[0] as TrackingRow | null
  },

  async findEvents(db: Pool, parcelId: string): Promise<EventRow[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT e.event_type, e.description, e.created_at, h.name AS hub_name
         FROM parcel_events e
         LEFT JOIN hubs h ON h.id = e.hub_id
        WHERE e.parcel_id = ?
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 100`,
      [parcelId],
    )
    return rows as EventRow[]
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
    parcelId: String(row.id),
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
