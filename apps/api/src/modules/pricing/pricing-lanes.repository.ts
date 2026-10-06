import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type {
  ListParams,
  PricingLane,
  PricingLaneWithSlabs,
  PricingSlab,
} from "@/db/models"
import {
  orderByClauseOf,
  pageOf,
  sortColumnOf,
  toDecimal,
  toUtcDate,
  whereClause,
} from "@/db/sql"
import { buildAssignments } from "@/db/updates"

/**
 * SQL for the lane matrix.
 *
 * The lane read and its slab read are separate queries rather than one join,
 * because a page of lanes with a LEFT JOIN multiplies rows: the count query
 * would count slabs and the decode would have to regroup them. Twelve lanes and
 * forty-eight slabs are two round trips, not twelve.
 */

const LANE_COLUMNS = `
  l.id, l.pickup_type, l.delivery_type, l.same_city, l.status, l.created_at, l.updated_at
`

const LANE_SORT_COLUMNS = ["l.pickup_type", "l.delivery_type", "l.status", "l.created_at"] as const
const LANE_TIEBREAK = "l.pickup_type ASC, l.delivery_type ASC, l.id ASC"

const SLAB_COLUMNS = `
  s.id, s.pricing_lane_id, s.min_weight_grams, s.max_weight_grams,
  s.base_fee, s.extra_kg_fee, s.cod_percentage, s.cod_fixed_fee,
  s.status, s.created_at, s.updated_at
`

/** One slab's ordering. `min_weight_grams` first, because that is the axis. */
const SLAB_ORDER = "s.min_weight_grams ASC, s.id ASC"

const SLAB_PATCH_COLUMNS = {
  minWeightGrams: "min_weight_grams",
  maxWeightGrams: "max_weight_grams",
  baseFee: "base_fee",
  extraKgFee: "extra_kg_fee",
  codPercentage: "cod_percentage",
  codFixedFee: "cod_fixed_fee",
  status: "status",
} as const

function laneRow(row: Record<string, unknown>): PricingLane {
  return {
    id: String(row.id),
    pickupType: row.pickup_type as PricingLane["pickupType"],
    deliveryType: row.delivery_type as PricingLane["deliveryType"],
    sameCity: Boolean(row.same_city),
    status: row.status as PricingLane["status"],
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

function slabRow(row: Record<string, unknown>): PricingSlab {
  return {
    id: String(row.id),
    pricingLaneId: String(row.pricing_lane_id),
    minWeightGrams: Number(row.min_weight_grams),
    maxWeightGrams: Number(row.max_weight_grams),
    baseFee: toDecimal(row.base_fee),
    extraKgFee: toDecimal(row.extra_kg_fee),
    codPercentage: toDecimal(row.cod_percentage),
    codFixedFee: toDecimal(row.cod_fixed_fee),
    status: row.status as PricingSlab["status"],
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

export type LaneFilter = {
  status?: PricingLane["status"] | undefined
}

export async function selectPricingLanes(
  db: Pool,
  params: ListParams,
  filter: LaneFilter,
): Promise<{ nodes: PricingLane[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.status) {
    clauses.push("l.status = ?")
    filterParams.push(filter.status)
  }
  const where = whereClause(clauses)
  const orderBy = orderByClauseOf(
    sortColumnOf(params, LANE_SORT_COLUMNS),
    params.sort,
    LANE_TIEBREAK,
  )

  return pageOf(db, {
    pageSql: `SELECT ${LANE_COLUMNS} FROM pricing_lanes AS l ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM pricing_lanes AS l${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: laneRow,
  })
}

export async function selectPricingLane(db: Pool, laneId: string): Promise<PricingLane | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${LANE_COLUMNS} FROM pricing_lanes AS l WHERE l.id = ?`,
    [laneId],
  )
  return rows[0] ? laneRow(rows[0]) : null
}

/**
 * Slabs for a set of lanes, grouped by lane id.
 *
 * Takes ids rather than one lane so a list screen fetches in one round trip.
 * An id not present in the result has no slabs — the caller decides whether
 * that is an empty array or a configuration error; for the matrix it is an
 * empty array, and it renders as a row with no bands.
 */
export async function selectSlabsForLanes(
  db: Pool,
  laneIds: readonly string[],
): Promise<Map<string, PricingSlab[]>> {
  const grouped = new Map<string, PricingSlab[]>()
  if (laneIds.length === 0) return grouped

  const placeholders = laneIds.map(() => "?").join(", ")
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${SLAB_COLUMNS} FROM pricing_slabs AS s
      WHERE s.pricing_lane_id IN (${placeholders})
      ORDER BY ${SLAB_ORDER}`,
    [...laneIds],
  )

  for (const row of rows) {
    const slab = slabRow(row)
    const bucket = grouped.get(slab.pricingLaneId)
    if (bucket) bucket.push(slab)
    else grouped.set(slab.pricingLaneId, [slab])
  }
  return grouped
}

export async function selectLaneSlabs(db: Pool, laneId: string): Promise<PricingSlab[]> {
  const grouped = await selectSlabsForLanes(db, [laneId])
  return grouped.get(laneId) ?? []
}

/** Attaches each lane's slabs, ordered by weight. */
export async function attachSlabs(
  db: Pool,
  lanes: readonly PricingLane[],
): Promise<PricingLaneWithSlabs[]> {
  const grouped = await selectSlabsForLanes(
    db,
    lanes.map((lane) => lane.id),
  )
  return lanes.map((lane) => ({ ...lane, slabs: grouped.get(lane.id) ?? [] }))
}

export async function selectSlab(db: Pool, slabId: string): Promise<PricingSlab | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${SLAB_COLUMNS} FROM pricing_slabs AS s WHERE s.id = ?`,
    [slabId],
  )
  return rows[0] ? slabRow(rows[0]) : null
}

/**
 * The overlap half of the no-overlap rule, expressed as one query.
 *
 * Two ranges intersect when each starts before the other ends, so the test is
 * `min <= other.max AND max >= other.min`. The unique keys on `(lane, min)` and
 * `(lane, max)` in the schema stop a duplicate boundary; only this stops
 * `0-500g` being added beside `0-200g`, which is the overlap the matrix must
 * never have.
 */
export async function selectOverlappingSlab(
  db: Pool,
  laneId: string,
  minWeightGrams: number,
  maxWeightGrams: number,
  exceptSlabId?: string,
): Promise<PricingSlab | null> {
  const clauses = [
    "pricing_lane_id = ?",
    "status = 'ACTIVE'",
    "min_weight_grams <= ?",
    "max_weight_grams >= ?",
  ]
  const params: unknown[] = [laneId, maxWeightGrams, minWeightGrams]

  if (exceptSlabId) {
    clauses.push("id <> ?")
    params.push(exceptSlabId)
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${SLAB_COLUMNS} FROM pricing_slabs AS s WHERE ${clauses.join(" AND ")} LIMIT 1`,
    params,
  )
  return rows[0] ? slabRow(rows[0]) : null
}

export async function patchPricingLane(
  db: Pool,
  laneId: string,
  patch: { status: PricingLane["status"] },
): Promise<PricingLane | null> {
  const { assignments, params } = buildAssignments(patch, { status: "status" })
  if (assignments.length === 0) return selectPricingLane(db, laneId)

  params.push(laneId)
  await db.execute<OkPacket>(
    `UPDATE pricing_lanes SET ${assignments.join(", ")} WHERE id = ?`,
    params,
  )
  return selectPricingLane(db, laneId)
}

export async function insertPricingSlab(
  db: Pool,
  record: Omit<PricingSlab, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO pricing_slabs
       (pricing_lane_id, min_weight_grams, max_weight_grams, base_fee, extra_kg_fee,
        cod_percentage, cod_fixed_fee, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.pricingLaneId,
      record.minWeightGrams,
      record.maxWeightGrams,
      record.baseFee,
      record.extraKgFee,
      record.codPercentage,
      record.codFixedFee,
      record.status,
    ],
  )
  if (!result.insertId) throw new Error("Pricing slab insert returned no id")
  return String(result.insertId)
}

export async function patchPricingSlab(
  db: Pool,
  slabId: string,
  patch: Partial<Omit<PricingSlab, "id" | "pricingLaneId" | "createdAt" | "updatedAt">>,
): Promise<PricingSlab | null> {
  const { assignments, params } = buildAssignments(patch, SLAB_PATCH_COLUMNS)
  if (assignments.length === 0) return selectSlab(db, slabId)

  params.push(slabId)
  await db.execute<OkPacket>(
    `UPDATE pricing_slabs SET ${assignments.join(", ")} WHERE id = ?`,
    params,
  )
  return selectSlab(db, slabId)
}

/**
 * COD settings across every slab in one statement.
 *
 * Deliberately every slab, active or not: a retired band that keeps the old COD
 * percentage and is later reactivated would silently price differently from its
 * neighbours.
 */
export async function updateCodEverywhere(
  db: Pool,
  codPercentage: number,
  codFixedFee: number,
): Promise<number> {
  const [result] = await db.execute<OkPacket>(
    `UPDATE pricing_slabs SET cod_percentage = ?, cod_fixed_fee = ?`,
    [codPercentage, codFixedFee],
  )
  return result.affectedRows
}
