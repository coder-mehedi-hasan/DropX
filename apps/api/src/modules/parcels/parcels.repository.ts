import {
  InsertBuilder,
  PARCEL_STATUSES,
  QueryBuilder,
  TABLES,
  toDecimal,
  toId,
  toNullableId,
  toStringOrNull,
  type Executor,
  type Id,
  type ListParams,
  type Parcel,
  type ParcelItem,
  type ParcelStatus,
  type ParcelType,
  type PaymentType,
  type SqlPrimitive,
} from "@dropx/db"

import type { Scope } from "../../shared/auth/auth-context"

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
  p.origin_hub_id, p.destination_hub_id, p.current_hub_id, p.destination_zone_id,
  p.weight, p.length, p.width, p.height, p.parcel_type, p.payment_type,
  p.cod_amount, p.delivery_fee, p.status, p.created_at, p.updated_at
`

/**
 * One hub column stands in for "where this parcel is now": its current hub, or
 * its destination hub while it is still inbound. Scoping on a single derived
 * column keeps the branch/hub rules in one place instead of per-query variants.
 */
const SCOPE_JOIN_ON = "scope_hub.id = COALESCE(p.current_hub_id, p.destination_hub_id)"

export type ListParcelsFilter = {
  status?: ParcelStatus | undefined
  hubId?: Id | undefined
  paymentType?: PaymentType | undefined
  search?: string | undefined
  searchFields?: readonly string[]
}

export function applyScope(builder: QueryBuilder, scope: Scope): QueryBuilder {
  if (scope.isCompanyWide) return builder
  if (scope.branchId) builder.where("scope_hub.branch_id = ?", scope.branchId)
  if (scope.hubIds.length > 0) builder.whereIn("scope_hub.id", scope.hubIds)
  return builder
}

export function applyFilters(builder: QueryBuilder, filter: ListParcelsFilter): QueryBuilder {
  if (filter.status) builder.where("p.status = ?", filter.status)
  if (filter.hubId) builder.where("p.current_hub_id = ?", filter.hubId)
  if (filter.paymentType) builder.where("p.payment_type = ?", filter.paymentType)
  if (filter.search && filter.searchFields) {
    builder.whereSearch(filter.search, filter.searchFields)
  }
  return builder
}

function baseQuery(): QueryBuilder {
  return new QueryBuilder()
    .select(SELECT_COLUMNS)
    .from(TABLES.parcels, "p")
    .leftJoin(TABLES.customers, "r.id = p.receiver_customer_id", "r")
    .leftJoin(TABLES.hubs, SCOPE_JOIN_ON, "scope_hub")
}

export async function listParcels(
  db: Executor,
  scope: Scope,
  params: ListParams,
  filter: ListParcelsFilter,
  sortColumns: readonly string[],
): Promise<{ nodes: Parcel[]; totalCount: number }> {
  const builder = applyScope(applyFilters(baseQuery(), filter), scope).orderByListParams(
    params,
    sortColumns,
    [
      { column: "p.created_at", direction: "desc" },
      { column: "p.id", direction: "desc" },
    ],
  )

  const countQuery = builder.buildCount()
  const pageQuery = builder.limit(params.limit).offset(params.offset).build()

  const [totalCount, rows] = await Promise.all([
    db.count(countQuery.sql, countQuery.params),
    db.query<ParcelRow>(pageQuery.sql, pageQuery.params),
  ])

  return { nodes: rows.rows.map(decodeParcel), totalCount }
}

export async function findParcelById(
  db: Executor,
  scope: Scope,
  parcelId: Id,
): Promise<Parcel | null> {
  const builder = applyScope(baseQuery().where("p.id = ?", parcelId), scope)

  const row = await db.queryOne<ParcelRow>(...queryParts(builder))
  return row ? decodeParcel(row) : null
}

/** Unscoped by design — used for public tracking and system-level jobs. */
export async function findParcelByTrackingNumber(
  db: Executor,
  trackingNumber: string,
): Promise<Parcel | null> {
  const row = await db.queryOne<ParcelRow>(
    `SELECT ${SELECT_COLUMNS} FROM ${TABLES.parcels} p WHERE p.tracking_number = ? LIMIT 1`,
    [trackingNumber],
  )
  return row ? decodeParcel(row) : null
}

/**
 * Customer-facing read. Scope is the customer id itself — a customer can only
 * ever see parcels they sent or received.
 */
export async function findParcelForCustomer(
  db: Executor,
  parcelId: Id,
  customerId: Id,
): Promise<Parcel | null> {
  const row = await db.queryOne<ParcelRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM ${TABLES.parcels} p
      WHERE p.id = ?
        AND (p.sender_customer_id = ? OR p.receiver_customer_id = ?)
      LIMIT 1`,
    [parcelId, customerId, customerId],
  )
  return row ? decodeParcel(row) : null
}

export async function listParcelsForCustomer(
  db: Executor,
  customerId: Id,
  params: ListParams,
  filter: ListParcelsFilter,
  sortColumns: readonly string[],
): Promise<{ nodes: Parcel[]; totalCount: number }> {
  const builder = new QueryBuilder()
    .select(SELECT_COLUMNS)
    .from(TABLES.parcels, "p")
    .leftJoin(TABLES.hubs, SCOPE_JOIN_ON, "scope_hub")
    .where("(p.sender_customer_id = ? OR p.receiver_customer_id = ?)", customerId, customerId)

  applyFilters(builder, filter)

  builder.orderByListParams(params, sortColumns, [
    { column: "p.created_at", direction: "desc" },
    { column: "p.id", direction: "desc" },
  ])

  const countQuery = builder.buildCount()
  const pageQuery = builder.limit(params.limit).offset(params.offset).build()

  const [totalCount, rows] = await Promise.all([
    db.count(countQuery.sql, countQuery.params),
    db.query<ParcelRow>(pageQuery.sql, pageQuery.params),
  ])

  return { nodes: rows.rows.map(decodeParcel), totalCount }
}

type CreateParcelRecord = {
  trackingNumber: string
  senderCustomerId: Id
  receiverCustomerId: Id
  originHubId: Id
  destinationHubId: Id
  currentHubId: Id | null
  destinationZoneId: Id
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

export async function insertParcel(db: Executor, record: CreateParcelRecord): Promise<Id> {
  const { sql, params } = new InsertBuilder(TABLES.parcels, {
    tracking_number: record.trackingNumber,
    sender_customer_id: record.senderCustomerId,
    receiver_customer_id: record.receiverCustomerId,
    origin_hub_id: record.originHubId,
    destination_hub_id: record.destinationHubId,
    current_hub_id: record.currentHubId,
    destination_zone_id: record.destinationZoneId,
    weight: record.weight,
    length: record.length,
    width: record.width,
    height: record.height,
    parcel_type: record.parcelType,
    payment_type: record.paymentType,
    cod_amount: record.codAmount,
    delivery_fee: record.deliveryFee,
    status: record.status,
  }).build()

  const result = await db.execute(sql, params)
  if (!result.insertId) throw new Error("Parcel insert returned no id")
  return result.insertId
}

export async function insertParcelItems(
  db: Executor,
  parcelId: Id,
  items: readonly { name: string; description?: string; quantity: number; unitPrice: number }[],
): Promise<void> {
  for (const item of items) {
    const { sql, params } = new InsertBuilder(TABLES.parcelItems, {
      parcel_id: parcelId,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: Math.round(item.unitPrice * item.quantity * 100) / 100,
    }).build()

    await db.execute(sql, params)
  }
}

/**
 * Status write. The scope predicate is required, not optional — an unscoped
 * UPDATE would let one branch edit another branch's parcel.
 */
export async function updateParcelStatus(
  db: Executor,
  scope: Scope,
  parcelId: Id,
  patch: { status: ParcelStatus; currentHubId?: Id | null | undefined },
): Promise<number> {
  const assignments: string[] = ["status = ?"]
  const params: (string | number | null)[] = [patch.status]

  if (patch.currentHubId !== undefined) {
    assignments.push("current_hub_id = ?")
    params.push(patch.currentHubId)
  }

  let sql = `UPDATE ${TABLES.parcels} SET ${assignments.join(", ")} WHERE id = ?`
  params.push(parcelId)

  if (!scope.isCompanyWide) {
    sql += ` AND (
      COALESCE(current_hub_id, destination_hub_id) IN (
        SELECT id FROM ${TABLES.hubs} WHERE 1 = 1
        ${scope.branchId ? "AND branch_id = ?" : ""}
        ${scope.hubIds.length > 0 ? `AND id IN (${scope.hubIds.map(() => "?").join(", ")})` : ""}
      )
    )`
    if (scope.branchId) params.push(scope.branchId)
    params.push(...scope.hubIds)
  }

  const result = await db.execute(sql, params)
  return result.affectedRows
}

export async function insertParcelEvent(
  db: Executor,
  input: {
    parcelId: Id
    eventType: string
    hubId?: Id | null | undefined
    userId?: Id | null | undefined
    riderId?: Id | null | undefined
    description?: string | null | undefined
  },
): Promise<void> {
  const { sql, params } = new InsertBuilder(TABLES.parcelEvents, {
    parcel_id: input.parcelId,
    event_type: input.eventType,
    hub_id: input.hubId ?? null,
    user_id: input.userId ?? null,
    rider_id: input.riderId ?? null,
    description: input.description ?? null,
  }).build()

  await db.execute(sql, params)
}

export async function listParcelItems(db: Executor, parcelId: Id): Promise<ParcelItem[]> {
  const rows = await db.query<ParcelItemRow>(
    `SELECT id, parcel_id, name, description, quantity, unit_price, total_price, created_at
       FROM ${TABLES.parcelItems}
      WHERE parcel_id = ?
      ORDER BY id`,
    [parcelId],
  )
  return rows.rows.map(decodeItem)
}

type ParcelRow = {
  id: string
  tracking_number: string
  sender_customer_id: string
  receiver_customer_id: string
  origin_hub_id: string
  destination_hub_id: string
  current_hub_id: string | null
  destination_zone_id: string
  weight: string
  length: string | null
  width: string | null
  height: string | null
  parcel_type: ParcelType
  payment_type: PaymentType
  cod_amount: string
  delivery_fee: string
  status: ParcelStatus
  created_at: string
  updated_at: string
}

export type ParcelItemRow = {
  id: string
  parcel_id: string
  name: string
  description: string | null
  quantity: string
  unit_price: string
  total_price: string
  created_at: string
}

function queryParts(builder: QueryBuilder): [string, SqlPrimitive[]] {
  const { sql, params } = builder.build()
  return [sql, params]
}

export function decodeParcel(row: ParcelRow): Parcel {
  return {
    id: toId(row.id),
    trackingNumber: row.tracking_number,
    senderCustomerId: toId(row.sender_customer_id, "senderCustomerId"),
    receiverCustomerId: toId(row.receiver_customer_id, "receiverCustomerId"),
    originHubId: toId(row.origin_hub_id, "originHubId"),
    destinationHubId: toId(row.destination_hub_id, "destinationHubId"),
    currentHubId: toNullableId(row.current_hub_id, "currentHubId"),
    destinationZoneId: toId(row.destination_zone_id, "destinationZoneId"),
    weight: toDecimal(row.weight),
    length: row.length === null ? null : toDecimal(row.length),
    width: row.width === null ? null : toDecimal(row.width),
    height: row.height === null ? null : toDecimal(row.height),
    parcelType: row.parcel_type,
    paymentType: row.payment_type,
    codAmount: toDecimal(row.cod_amount),
    deliveryFee: toDecimal(row.delivery_fee),
    status: row.status,
    createdAt: new Date(`${row.created_at.replace(" ", "T")}Z`),
    updatedAt: new Date(`${row.updated_at.replace(" ", "T")}Z`),
  }
}

export function decodeItem(row: ParcelItemRow): ParcelItem {
  return {
    id: toId(row.id),
    parcelId: toId(row.parcel_id, "parcelId"),
    name: row.name,
    description: toStringOrNull(row.description),
    quantity: Number(row.quantity),
    unitPrice: toDecimal(row.unit_price),
    totalPrice: toDecimal(row.total_price),
    createdAt: new Date(`${row.created_at.replace(" ", "T")}Z`),
  }
}

export { PARCEL_STATUSES }
