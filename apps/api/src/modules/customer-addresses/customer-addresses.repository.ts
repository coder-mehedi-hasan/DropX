import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import { buildAssignments } from "@/db/updates"
import { toUtcDate } from "@/db/sql"

/**
 * Persistence for the customer's saved-address book.
 *
 * Every query is scoped to a `customer_id` — a customer only ever reads or
 * writes their own addresses, and the scope is a column predicate rather than a
 * post-fetch filter, so a wrong id returns zero rows rather than someone else's
 * address book.
 *
 * The location names are joined from `service_cities`/`service_zones`/
 * `service_areas` on every read. A saved address is editable, so it shows the
 * location's current name; snapshotting one would freeze a rename out of the
 * book the customer is looking at.
 */

const ADDRESS_COLUMNS = `
  a.id, a.customer_id, a.label, a.city_id, a.zone_id, a.area_id,
  a.address_line, a.landmark, a.latitude, a.longitude, a.is_default,
  a.created_at, a.updated_at
`

const ADDRESS_JOINS = `
  JOIN service_cities AS city ON city.id = a.city_id
  JOIN service_zones AS zone ON zone.id = a.zone_id
  LEFT JOIN service_areas AS area ON area.id = a.area_id
`

const PATCH_COLUMNS = {
  label: "label",
  cityId: "city_id",
  zoneId: "zone_id",
  areaId: "area_id",
  addressLine: "address_line",
  landmark: "landmark",
  latitude: "latitude",
  longitude: "longitude",
  isDefault: "is_default",
} as const

export type CustomerAddressRecord = {
  id: string
  customerId: string
  label: string | null
  cityId: string
  zoneId: string
  areaId: string | null
  cityName: string
  zoneName: string
  areaName: string | null
  addressLine: string
  landmark: string | null
  latitude: number | null
  longitude: number | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

function addressRow(row: Record<string, unknown>): CustomerAddressRecord {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    label: row.label === null ? null : String(row.label),
    cityId: String(row.city_id),
    zoneId: String(row.zone_id),
    areaId: row.area_id === null ? null : String(row.area_id),
    cityName: String(row.city_name),
    zoneName: String(row.zone_name),
    areaName: row.area_name === null ? null : String(row.area_name),
    addressLine: String(row.address_line),
    landmark: row.landmark === null ? null : String(row.landmark),
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    isDefault: Boolean(row.is_default),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

export async function insertCustomerAddress(
  db: Pool,
  record: {
    customerId: string
    label: string | null
    cityId: string
    zoneId: string
    areaId: string | null
    addressLine: string
    landmark: string | null
    latitude: number | null
    longitude: number | null
  },
): Promise<string> {
  const sql = `INSERT INTO customer_addresses
    (customer_id, label, city_id, zone_id, area_id, address_line, landmark, latitude, longitude, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false)`
  const [result] = await db.execute<OkPacket>(sql, [
    record.customerId,
    record.label,
    record.cityId,
    record.zoneId,
    record.areaId,
    record.addressLine,
    record.landmark,
    record.latitude,
    record.longitude,
  ])
  if (!result.insertId) throw new Error("Customer address insert returned no id")
  return String(result.insertId)
}

export async function selectCustomerAddress(
  db: Pool,
  customerId: string,
  addressId: string,
): Promise<CustomerAddressRecord | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${ADDRESS_COLUMNS}, city.name AS city_name, zone.name AS zone_name, area.name AS area_name
       FROM customer_addresses AS a${ADDRESS_JOINS}
      WHERE a.customer_id = ? AND a.id = ?
      LIMIT 1`,
    [customerId, addressId],
  )
  return rows[0] ? addressRow(rows[0]) : null
}

export async function listCustomerAddresses(
  db: Pool,
  customerId: string,
): Promise<CustomerAddressRecord[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${ADDRESS_COLUMNS}, city.name AS city_name, zone.name AS zone_name, area.name AS area_name
       FROM customer_addresses AS a${ADDRESS_JOINS}
      WHERE a.customer_id = ?
      ORDER BY a.is_default DESC, a.id ASC`,
    [customerId],
  )
  return rows.map(addressRow)
}

export async function updateCustomerAddress(
  db: Pool,
  customerId: string,
  addressId: string,
  patch: Partial<{
    label: string | null
    cityId: string
    zoneId: string
    areaId: string | null
    addressLine: string
    landmark: string | null
    latitude: number | null
    longitude: number | null
    isDefault: boolean
  }>,
): Promise<CustomerAddressRecord | null> {
  const { assignments, params } = buildAssignments(patch, PATCH_COLUMNS)
  if (assignments.length === 0) return selectCustomerAddress(db, customerId, addressId)

  const sql = `UPDATE customer_addresses SET ${assignments.join(", ")} WHERE customer_id = ? AND id = ?`
  params.push(customerId, addressId)

  await db.execute<OkPacket>(sql, params)
  return selectCustomerAddress(db, customerId, addressId)
}

export async function deleteCustomerAddress(
  db: Pool,
  customerId: string,
  addressId: string,
): Promise<boolean> {
  const [result] = await db.execute<OkPacket>(
    `DELETE FROM customer_addresses WHERE customer_id = ? AND id = ?`,
    [customerId, addressId],
  )
  return result.affectedRows > 0
}
