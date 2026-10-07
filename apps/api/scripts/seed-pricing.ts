#!/usr/bin/env bun
/**
 * Seeds the twelve-lane × four-slab pricing matrix from
 * `docs/plans/migration-price-and-location.md` Phase 6.
 *
 * Idempotent and non-destructive by construction: lanes and slabs are inserted
 * on their natural keys, while an existing row is left unchanged. Re-running
 * this at container startup therefore fills missing defaults without undoing
 * prices, statuses, or COD settings edited by production staff. The separate
 * `seed:locations` command imports the prepared city -> zone -> area catalog.
 *
 * Honest about one seam: the twelfth lane (ISD_ON_DEMAND → SAME_CITY_ON_DEMAND)
 * is seeded because the plan seeds it, but nothing yet books on-demand parcels,
 * so it is inert until express delivery becomes a stored parcel option.
 */
import mysql from "mysql2/promise"

import { closePool } from "../src/db/pool"

type LaneKey = { pickupType: string; deliveryType: string; sameCity: boolean }
type SlabBand = { minWeightGrams: number; maxWeightGrams: number }

/** The upsert just wrote the row, so the lookup must find it. Throw, never guess. */
function requireId(rows: mysql.RowDataPacket[], what: string): string {
  const row = rows[0]
  if (!row) throw new Error(`Seeded ${what} not found`)
  return String(row.id)
}

const BANDS: SlabBand[] = [
  { minWeightGrams: 0, maxWeightGrams: 200 },
  { minWeightGrams: 201, maxWeightGrams: 500 },
  { minWeightGrams: 501, maxWeightGrams: 1000 },
  { minWeightGrams: 1001, maxWeightGrams: 2000 },
]

/** Seed COD figures — percentage + fixed handling fee, applied at quote time. */
const COD_PERCENTAGE = 1.5
const COD_FIXED_FEE = 20

/** The extra-weight rule: +20 BDT per kg (or part) above the 2kg band. */
const EXTRA_KG_FEE = 20

/** Prices per band, in grams order, matching the plan's Phase 6 table. */
const MATRIX: (LaneKey & { prices: number[] })[] = [
  { pickupType: "ISD", deliveryType: "ISD", sameCity: false, prices: [60, 60, 70, 90] },
  { pickupType: "ISD", deliveryType: "SUBURB", sameCity: false, prices: [80, 80, 100, 130] },
  { pickupType: "ISD", deliveryType: "OSD", sameCity: false, prices: [110, 110, 130, 170] },
  { pickupType: "SUBURB", deliveryType: "SAME_CITY", sameCity: true, prices: [60, 60, 70, 90] },
  { pickupType: "SUBURB", deliveryType: "ISD", sameCity: false, prices: [80, 80, 100, 130] },
  {
    pickupType: "SUBURB",
    deliveryType: "DIFFERENT_CITY",
    sameCity: false,
    prices: [80, 80, 100, 130],
  },
  { pickupType: "SUBURB", deliveryType: "OSD", sameCity: false, prices: [110, 110, 130, 170] },
  { pickupType: "OSD", deliveryType: "SAME_CITY", sameCity: true, prices: [60, 60, 70, 90] },
  { pickupType: "OSD", deliveryType: "ISD", sameCity: false, prices: [110, 110, 130, 170] },
  { pickupType: "OSD", deliveryType: "SUBURB", sameCity: false, prices: [110, 110, 130, 170] },
  {
    pickupType: "OSD",
    deliveryType: "DIFFERENT_CITY",
    sameCity: false,
    prices: [120, 120, 145, 180],
  },
  {
    pickupType: "ISD_ON_DEMAND",
    deliveryType: "SAME_CITY_ON_DEMAND",
    sameCity: true,
    prices: [120, 120, 150, 150],
  },
]

const UPSERT_LANE = `INSERT INTO pricing_lanes (pickup_type, delivery_type, same_city, status)
  VALUES (?, ?, ?, 'ACTIVE')
  ON DUPLICATE KEY UPDATE id = id`

const UPSERT_SLAB = `INSERT INTO pricing_slabs
  (pricing_lane_id, min_weight_grams, max_weight_grams, base_fee, extra_kg_fee, cod_percentage, cod_fixed_fee, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  ON DUPLICATE KEY UPDATE id = id`

function validateCatalog(): void {
  if (MATRIX.length !== 12)
    throw new Error(`Pricing matrix has ${MATRIX.length} lanes, expected 12`)

  const laneKeys = new Set<string>()
  for (const lane of MATRIX) {
    const key = `${lane.pickupType}:${lane.deliveryType}:${lane.sameCity}`
    if (laneKeys.has(key)) throw new Error(`Duplicate pricing lane ${key}`)
    laneKeys.add(key)
    if (lane.prices.length !== BANDS.length) {
      throw new Error(
        `Matrix row ${key} has ${lane.prices.length} prices, expected ${BANDS.length}`,
      )
    }
  }

  for (let index = 0; index < BANDS.length; index += 1) {
    const band = BANDS[index]!
    if (band.maxWeightGrams <= band.minWeightGrams) {
      throw new Error(`Invalid weight band ${band.minWeightGrams}-${band.maxWeightGrams}g`)
    }
    const previous = BANDS[index - 1]
    if (previous && band.minWeightGrams !== previous.maxWeightGrams + 1) {
      throw new Error(`Weight bands are not contiguous at ${band.minWeightGrams}g`)
    }
  }
}

async function seedMatrix(pool: mysql.Pool): Promise<void> {
  for (const lane of MATRIX) {
    await pool.execute(UPSERT_LANE, [lane.pickupType, lane.deliveryType, lane.sameCity])

    const [laneRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id FROM pricing_lanes
        WHERE pickup_type = ? AND delivery_type = ? AND same_city = ?`,
      [lane.pickupType, lane.deliveryType, lane.sameCity],
    )
    const laneId = requireId(laneRows, `lane ${lane.pickupType}/${lane.deliveryType}`)

    for (let i = 0; i < BANDS.length; i++) {
      // The per-band figure is the flat base fee. Only the top band carries an
      // extra-weight charge, and COD is the same company-wide rule everywhere.
      // `band` is safe: prices.length === BANDS.length was checked above.
      const band = BANDS[i]!
      const isTop = i === BANDS.length - 1
      await pool.execute(UPSERT_SLAB, [
        laneId,
        band.minWeightGrams,
        band.maxWeightGrams,
        lane.prices[i]!,
        isTop ? EXTRA_KG_FEE : 0,
        COD_PERCENTAGE,
        COD_FIXED_FEE,
      ])

      const [slabRows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT max_weight_grams
           FROM pricing_slabs
          WHERE pricing_lane_id = ? AND min_weight_grams = ?
          LIMIT 1`,
        [laneId, band.minWeightGrams],
      )
      const stored = slabRows[0]
      if (!stored || Number(stored.max_weight_grams) !== band.maxWeightGrams) {
        throw new Error(
          `Pricing lane ${lane.pickupType}/${lane.deliveryType} has a conflicting slab at ${band.minWeightGrams}g`,
        )
      }
    }

    console.log(
      `  · ${lane.pickupType} → ${lane.deliveryType}${lane.sameCity ? " (same city)" : ""}: ${lane.prices.join("/")}`,
    )
  }
}

async function main(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not set")

  validateCatalog()

  const pool = mysql.createPool(DATABASE_URL)
  try {
    console.log("· seeding pricing matrix")
    await seedMatrix(pool)
    console.log("✓ done")
  } finally {
    await closePool(pool)
  }
}

main().catch((error: unknown) => {
  console.error("✗ seeding failed")
  console.error(error)
  process.exit(1)
})
