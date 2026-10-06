import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"
import { PARCEL_STATUSES } from "@/db/models"
import type {
  ListParams,
  Parcel,
  ParcelAddress,
  ParcelAddressType,
  ParcelItem,
  ParcelStatus,
  ParcelType,
  PaymentType,
} from "@/db/models"
import { toDecimal, toUtcDate } from "@/db/sql"
import type { Scope } from "@/shared/auth/auth-context"

/**
 * Persistence for `parcels`, always scoped.
 *
 * DropX is single-tenant, so there is no `org_id` to filter on. The equivalent
 * guard is `Scope`: company-wide (ADMIN) adds nothing, branch staff are limited
 * to their `branch_id`, hub operators to their `user_hubs`. `applyScope` is
 * applied by every function in this file — an unscoped read is a review blocker.
 */

const SELECT_COLUMNS = `
  p.id, p.tracking_number, p.sender_customer_id, p.receiver_customer_id,
  p.receiver_name, p.receiver_phone, p.receiver_secondary_phone, p.receiver_address,
  p.origin_hub_id, p.destination_hub_id, p.current_hub_id, p.destination_zone_id,
  p.weight, p.length, p.width, p.height, p.parcel_type, p.payment_type,
  p.cod_amount, p.delivery_fee, p.status, p.created_at, p.updated_at
`

const SCOPE_JOIN_ON = "scope_hub.id = COALESCE(p.current_hub_id, p.destination_hub_id)"

export type ListParcelsFilter = {
  status?: ParcelStatus | undefined
  hubId?: string | undefined
  paymentType?: PaymentType | undefined
  search?: string | undefined
  searchFields?: readonly string[]
  customerId?: string | undefined
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ")
}

type Clause = { text: string; params: unknown[] }

/**
 * Joins conditions into a single parenthesised expression — **not** a `WHERE`
 * clause. Scope and filters are combined with each other and with a search
 * clause, so a `WHERE` baked in here was nested inside another `WHERE` and the
 * query was a syntax error the moment two of them were present. Callers prefix
 * the keyword.
 */
function combineClauses(clauses: Clause[]): Clause {
  if (clauses.length === 0) return { text: "", params: [] }
  return {
    text: `(${clauses.map((c) => c.text).join(") AND (")})`,
    params: clauses.flatMap((c) => c.params),
  }
}

export function applyScope(scope: Scope): Clause {
  const clauses: Clause[] = []
  if (scope.isCompanyWide) return combineClauses(clauses)
  if (scope.branchId) clauses.push({ text: "scope_hub.branch_id = ?", params: [scope.branchId] })
  if (scope.hubIds.length > 0) {
    clauses.push({
      text: `scope_hub.id IN (${placeholders(scope.hubIds.length)})`,
      params: scope.hubIds,
    })
  }
  return combineClauses(clauses)
}

export function applyFilters(filter: ListParcelsFilter): Clause {
  const clauses: Clause[] = []
  if (filter.status) clauses.push({ text: "p.status = ?", params: [filter.status] })
  if (filter.hubId) clauses.push({ text: "p.current_hub_id = ?", params: [filter.hubId] })
  if (filter.paymentType) clauses.push({ text: "p.payment_type = ?", params: [filter.paymentType] })
  if (filter.customerId) {
    clauses.push({
      text: "(p.sender_customer_id = ? OR p.receiver_customer_id = ?)",
      params: [filter.customerId, filter.customerId],
    })
  }
  if (filter.search && filter.searchFields) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push({
      text: `(${filter.searchFields.map((f) => `${f} LIKE ?`).join(" OR ")})`,
      params: new Array(filter.searchFields.length).fill(like),
    })
  }
  return combineClauses(clauses)
}

function baseSql(): string {
  return `SELECT ${SELECT_COLUMNS} FROM parcels AS p LEFT JOIN customers AS r ON r.id = p.receiver_customer_id LEFT JOIN hubs AS scope_hub ON ${SCOPE_JOIN_ON}`
}

const PARCEL_JOINS = ` LEFT JOIN customers AS r ON r.id = p.receiver_customer_id LEFT JOIN hubs AS scope_hub ON ${SCOPE_JOIN_ON}`

async function pageOf<T>(
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
  return { nodes: rows.map(decode), totalCount }
}

export async function listParcels(
  db: Pool | Connection,
  scope: Scope,
  params: ListParams,
  filter: ListParcelsFilter,
  sortColumnByKey: Readonly<Record<string, string>>,
): Promise<{ nodes: Parcel[]; totalCount: number }> {
  const clauses: Clause[] = []
  const scopeClause = applyScope(scope)
  if (scopeClause.params.length) clauses.push(scopeClause)
  const filterClause = applyFilters(filter)
  if (filterClause.params.length) clauses.push(filterClause)
  const where = clauses.length ? `WHERE (${clauses.map((c) => c.text).join(") AND (")})` : ""
  const whereParams = clauses.flatMap((c) => c.params)

  // Both queries join `scope_hub`, because `applyScope` writes `scope_hub.branch_id`
  // and `scope_hub.id`. Omitting the join here fails only for a *scoped* caller —
  // a company-wide read emits no scope clause and never notices — so the parcel
  // list 500s for every branch manager and hub-scoped dispatcher while working
  // perfectly for an ADMIN. `check:read-paths` now runs this query scoped for
  // exactly that reason.
  //
  // `customers r` rides along too: the search columns reference `r.name` and
  // `r.phone`, so leaving the join off 500s the *all* callers the moment a
  // search is typed (ADMIN included). Same defence — `check:read-paths` runs a
  // search case against the real schema.
  const countSql = `SELECT COUNT(*) AS count FROM parcels AS p${PARCEL_JOINS}${where ? " " + where : ""}`
  const sortColumn = params.sortBy ? sortColumnByKey[params.sortBy] : undefined
  const orderByClause = sortColumn
    ? `${sortColumn} ${params.sort.toUpperCase()}, p.created_at DESC, p.id DESC`
    : `p.created_at DESC, p.id DESC`

  const pageSql = `SELECT ${SELECT_COLUMNS} FROM parcels AS p${PARCEL_JOINS} ${where} ORDER BY ${orderByClause} LIMIT ? OFFSET ?`
  const pageParams = [...whereParams, params.limit, params.offset]

  return pageOf(db, pageSql, pageParams, countSql, whereParams, decodeParcel)
}

export async function findParcelById(
  db: Pool | Connection,
  scope: Scope,
  parcelId: string,
): Promise<Parcel | null> {
  const scopeClause = applyScope(scope)
  const clauses: Clause[] = scopeClause.params.length ? [scopeClause] : []
  clauses.push({ text: "p.id = ?", params: [parcelId] })
  const where = clauses.length ? `WHERE (${clauses.map((c) => c.text).join(") AND (")})` : ""
  const params = clauses.flatMap((c) => c.params)

  const [rows] = await db.query<RowDataPacket[]>(`${baseSql()} ${where} LIMIT 1`, params)
  return rows[0] ? decodeParcel(rows[0] as ParcelRow) : null
}

/** Unscoped by design — used for public tracking and system-level jobs. */
export async function findParcelByTrackingNumber(
  db: Pool | Connection,
  trackingNumber: string,
): Promise<Parcel | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLUMNS} FROM parcels AS p WHERE p.tracking_number = ? LIMIT 1`,
    [trackingNumber],
  )
  return rows[0] ? decodeParcel(rows[0] as ParcelRow) : null
}

/**
 * Customer-facing read. Scope is the customer id itself — a customer can only
 * ever see parcels they sent or received.
 */
export async function findParcelForCustomer(
  db: Pool | Connection,
  parcelId: string,
  customerId: string,
): Promise<Parcel | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${SELECT_COLUMNS} FROM parcels AS p WHERE p.id = ? AND (p.sender_customer_id = ? OR p.receiver_customer_id = ?) LIMIT 1`,
    [parcelId, customerId, customerId],
  )
  return rows[0] ? decodeParcel(rows[0] as ParcelRow) : null
}

export async function listParcelsForCustomer(
  db: Pool | Connection,
  customerId: string,
  params: ListParams,
  filter: ListParcelsFilter,
  sortColumnByKey: Readonly<Record<string, string>>,
): Promise<{ nodes: Parcel[]; totalCount: number }> {
  const clauses: Clause[] = [
    {
      text: "(p.sender_customer_id = ? OR p.receiver_customer_id = ?)",
      params: [customerId, customerId],
    },
  ]
  const filterClause = applyFilters(filter)
  if (filterClause.params.length) clauses.push(filterClause)
  const where = clauses.length ? `WHERE (${clauses.map((c) => c.text).join(") AND (")})` : ""
  const whereParams = clauses.flatMap((c) => c.params)

  const countSql = `SELECT COUNT(*) AS count FROM parcels AS p${PARCEL_JOINS}${where ? " " + where : ""}`
  const sortColumn = params.sortBy ? sortColumnByKey[params.sortBy] : undefined
  const orderByClause = sortColumn
    ? `${sortColumn} ${params.sort.toUpperCase()}, p.created_at DESC, p.id DESC`
    : `p.created_at DESC, p.id DESC`

  const pageSql = `SELECT ${SELECT_COLUMNS} FROM parcels AS p${PARCEL_JOINS} ${where} ORDER BY ${orderByClause} LIMIT ? OFFSET ?`
  const pageParams = [...whereParams, params.limit, params.offset]

  return pageOf(db, pageSql, pageParams, countSql, whereParams, decodeParcel)
}

type CreateParcelRecord = {
  trackingNumber: string
  senderCustomerId: string
  receiverCustomerId: string | null
  receiverName: string
  receiverPhone: string
  receiverSecondaryPhone?: string | undefined
  originHubId: string
  destinationHubId: string
  currentHubId: string | null
  weight: number
  length?: number | undefined
  width?: number | undefined
  height?: number | undefined
  parcelType: ParcelType
  paymentType: PaymentType
  codAmount: number
  deliveryFee: number
  status: ParcelStatus
}

export async function insertParcel(
  db: Pool | Connection,
  record: CreateParcelRecord,
): Promise<string> {
  const fields: string[] = []
  const params: (string | number | null)[] = []
  const push = (field: string, value: string | number | null | undefined) => {
    if (value !== undefined) {
      fields.push(field)
      params.push(value)
    }
  }
  push("tracking_number", record.trackingNumber)
  push("sender_customer_id", record.senderCustomerId)
  push("receiver_customer_id", record.receiverCustomerId)
  push("receiver_name", record.receiverName)
  push("receiver_phone", record.receiverPhone)
  push("receiver_secondary_phone", record.receiverSecondaryPhone)
  push("origin_hub_id", record.originHubId)
  push("destination_hub_id", record.destinationHubId)
  push("current_hub_id", record.currentHubId)
  push("weight", record.weight)
  push("length", record.length)
  push("width", record.width)
  push("height", record.height)
  push("parcel_type", record.parcelType)
  push("payment_type", record.paymentType)
  push("cod_amount", record.codAmount)
  push("delivery_fee", record.deliveryFee)
  push("status", record.status)

  const sql = `INSERT INTO parcels (${fields.join(", ")}) VALUES (${placeholders(fields.length)})`
  const [result] = await db.execute<OkPacket>(sql, params)
  if (!result.insertId) throw new Error("Parcel insert returned no id")
  return String(result.insertId)
}

export async function insertParcelItems(
  db: Pool | Connection,
  parcelId: string,
  items: readonly { name: string; description?: string; quantity: number; unitPrice: number }[],
): Promise<void> {
  for (const item of items) {
    const fields: string[] = ["parcel_id", "name", "quantity", "unit_price", "total_price"]
    const params = [
      parcelId,
      item.name,
      item.quantity,
      item.unitPrice,
      Math.round(item.unitPrice * item.quantity * 100) / 100,
    ]
    if (item.description !== undefined) {
      fields.push("description")
      params.push(item.description)
    }
    const sql = `INSERT INTO parcel_items (${fields.join(", ")}) VALUES (${placeholders(fields.length)})`
    await db.execute<OkPacket>(sql, params)
  }
}

/** A resolved address, ready for the column — names already snapshotted. */
export type ParcelAddressRecord = {
  type: ParcelAddressType
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
}

/**
 * Both ends of the trip, written in the same transaction as the parcel.
 *
 * The ids are foreign keys and the names are snapshots taken at booking: the
 * ids keep `city → zone → area` enforceable, and the names keep the address
 * readable after a location is retired. One row per `(parcel, type)` — the
 * unique key is what stops a retry appending a second pickup address.
 */
export async function insertParcelAddresses(
  db: Pool | Connection,
  parcelId: string,
  addresses: readonly ParcelAddressRecord[],
): Promise<void> {
  const sql = `INSERT INTO parcel_addresses
      (parcel_id, type, city_id, zone_id, area_id, city_name, zone_name, area_name,
       address_line, landmark, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

  for (const address of addresses) {
    await db.execute<OkPacket>(sql, [
      parcelId,
      address.type,
      address.cityId,
      address.zoneId,
      address.areaId,
      address.cityName,
      address.zoneName,
      address.areaName,
      address.addressLine,
      address.landmark,
      address.latitude,
      address.longitude,
    ])
  }
}

export async function listParcelAddresses(
  db: Pool | Connection,
  parcelId: string,
): Promise<ParcelAddress[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, parcel_id, type, city_id, zone_id, area_id, city_name, zone_name, area_name,
            address_line, landmark, latitude, longitude, created_at, updated_at
       FROM parcel_addresses
      WHERE parcel_id = ?
      ORDER BY type`,
    [parcelId],
  )

  return rows.map((row): ParcelAddress => ({
    id: String(row.id),
    parcelId: String(row.parcel_id),
    type: row.type as ParcelAddressType,
    cityId: String(row.city_id),
    zoneId: String(row.zone_id),
    areaId: toNullableId(row.area_id),
    cityName: row.city_name,
    zoneName: row.zone_name,
    areaName: toStringOrNull(row.area_name),
    addressLine: row.address_line,
    landmark: toStringOrNull(row.landmark),
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }))
}

/**
 * Status write. The scope predicate is required, not optional — an unscoped
 * UPDATE would let one branch edit another branch's parcel.
 */
export async function updateParcelStatus(
  db: Pool | Connection,
  scope: Scope,
  parcelId: string,
  patch: { status: ParcelStatus; currentHubId?: string | null | undefined },
): Promise<number> {
  const assignments: string[] = ["status = ?"]
  const params: (string | number | null)[] = [patch.status]

  if (patch.currentHubId !== undefined) {
    assignments.push("current_hub_id = ?")
    params.push(patch.currentHubId)
  }

  let sql = `UPDATE parcels SET ${assignments.join(", ")} WHERE id = ?`
  params.push(parcelId)

  if (!scope.isCompanyWide) {
    sql += ` AND (
      COALESCE(current_hub_id, destination_hub_id) IN (
        SELECT id FROM hubs WHERE 1 = 1
        ${scope.branchId ? "AND branch_id = ?" : ""}
        ${scope.hubIds.length > 0 ? `AND id IN (${scope.hubIds.map(() => "?").join(", ")})` : ""}
      )
    )`
    if (scope.branchId) params.push(scope.branchId)
    params.push(...scope.hubIds)
  }

  const [result] = await db.execute<OkPacket>(sql, params)
  return result.affectedRows
}

/**
 * Locks the parcel row a create-side operation will belong to, in scope.
 *
 * `reference` is matched against **either** the id or the tracking number. That is
 * not leniency for its own sake: the id is never shown to a human anywhere, while
 * the tracking number is the only string a customer can read out over the phone.
 * Accepting a field that callers cannot possibly know would make the whole create
 * path unusable.
 *
 * The lock exists to serialise concurrent creates rather than to read anything:
 * two dispatchers raising work against the same parcel at the same moment would
 * each pass an "is there already an open row?" check and both insert. Locking the
 * shared parent row makes the second one wait, then see the first.
 */
export async function lockScopedParcelForUpdate(
  db: Pool | Connection,
  scope: Scope,
  reference: string,
): Promise<string | null> {
  const clauses = ["(p.id = ? OR p.tracking_number = ?)"]
  const params: unknown[] = [reference, reference]
  const scoped = applyScope(scope)
  if (scoped.params.length > 0) {
    clauses.push(scoped.text)
    params.push(...scoped.params)
  }

  // The `scope_hub` alias is what `applyScope` writes against, so this joins the
  // same way the rest of this file does rather than restating the condition.
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.id FROM parcels AS p
     LEFT JOIN hubs AS scope_hub ON scope_hub.id = COALESCE(p.current_hub_id, p.destination_hub_id)
     WHERE ${clauses.join(" AND ")} LIMIT 1 FOR UPDATE`,
    params,
  )
  return rows[0] ? String(rows[0].id) : null
}

export async function insertParcelEvent(
  db: Pool | Connection,
  input: {
    parcelId: string
    eventType: string
    hubId?: string | null | undefined
    userId?: string | null | undefined
    riderId?: string | null | undefined
    description?: string | null | undefined
  },
): Promise<void> {
  const fields: string[] = ["parcel_id", "event_type"]
  const params: (string | null)[] = [input.parcelId, input.eventType]
  const push = (field: string, value: string | null | undefined) => {
    if (value !== undefined) {
      fields.push(field)
      params.push(value)
    }
  }
  push("hub_id", input.hubId)
  push("user_id", input.userId)
  push("rider_id", input.riderId)
  push("description", input.description)

  const sql = `INSERT INTO parcel_events (${fields.join(", ")}) VALUES (${placeholders(fields.length)})`
  await db.execute<OkPacket>(sql, params)
}

export async function listParcelItems(
  db: Pool | Connection,
  parcelId: string,
): Promise<ParcelItem[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, parcel_id, name, description, quantity, unit_price, total_price, created_at
       FROM parcel_items
      WHERE parcel_id = ?
      ORDER BY id`,
    [parcelId],
  )
  return (rows as ParcelItemRow[]).map(decodeItem)
}

type ParcelRow = {
  id: string
  tracking_number: string
  sender_customer_id: string
  receiver_customer_id: string | null
  receiver_name: string
  receiver_phone: string
  receiver_secondary_phone: string | null
  receiver_address: string | null
  origin_hub_id: string
  destination_hub_id: string
  current_hub_id: string | null
  destination_zone_id: string | null
  weight: string
  length: string | null
  width: string | null
  height: string | null
  parcel_type: ParcelType
  payment_type: PaymentType
  cod_amount: string
  delivery_fee: string
  status: ParcelStatus
  created_at: string | Date
  updated_at: string | Date
}

export type ParcelItemRow = {
  id: string
  parcel_id: string
  name: string
  description: string | null
  quantity: string
  unit_price: string
  total_price: string
  created_at: string | Date
}

function toNullableId(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

export function decodeParcel(row: unknown): Parcel {
  const r = row as ParcelRow
  return {
    id: String(r.id),
    trackingNumber: r.tracking_number,
    senderCustomerId: String(r.sender_customer_id),
    receiverCustomerId: toNullableId(r.receiver_customer_id),
    receiverName: r.receiver_name,
    receiverPhone: r.receiver_phone,
    receiverSecondaryPhone: toStringOrNull(r.receiver_secondary_phone),
    receiverAddress: toStringOrNull(r.receiver_address),
    originHubId: String(r.origin_hub_id),
    destinationHubId: String(r.destination_hub_id),
    currentHubId: toNullableId(r.current_hub_id),
    destinationZoneId: toStringOrNull(r.destination_zone_id),
    weight: toDecimal(r.weight),
    length: r.length === null ? null : toDecimal(r.length),
    width: r.width === null ? null : toDecimal(r.width),
    height: r.height === null ? null : toDecimal(r.height),
    parcelType: r.parcel_type,
    paymentType: r.payment_type,
    codAmount: toDecimal(r.cod_amount),
    deliveryFee: toDecimal(r.delivery_fee),
    status: r.status,
    createdAt: toUtcDate(r.created_at).toISOString(),
    updatedAt: toUtcDate(r.updated_at).toISOString(),
  }
}

export function decodeItem(row: unknown): ParcelItem {
  const r = row as ParcelItemRow
  return {
    id: String(r.id),
    parcelId: String(r.parcel_id),
    name: r.name,
    description: toStringOrNull(r.description),
    quantity: Number(r.quantity),
    unitPrice: toDecimal(r.unit_price),
    totalPrice: toDecimal(r.total_price),
    createdAt: toUtcDate(r.created_at).toISOString(),
  }
}

export { PARCEL_STATUSES }
