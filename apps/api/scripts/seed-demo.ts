#!/usr/bin/env bun
/**
 * Seeds the minimum operational catalog needed to try customer booking locally.
 *
 * This is intentionally separate from `db:seed`: production role seeding should
 * not create fictional branches, hubs, zones, or prices. Every lookup is by a
 * stable code/name, so running this repeatedly is safe.
 */
import mysql from "mysql2/promise"

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) throw new Error("DATABASE_URL is not set")

const pool = mysql.createPool(DATABASE_URL)

async function ensureBranch(): Promise<string> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM branches WHERE code = 'DPX-DEMO' LIMIT 1`,
  )
  if (rows[0]) return String(rows[0].id)

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO branches (name, code, city, district, status)
     VALUES ('DropX Demo Branch', 'DPX-DEMO', 'Dhaka', 'Dhaka', 'ACTIVE')`,
  )
  return String(result.insertId)
}

async function ensureHub(
  branchId: string,
  input: { name: string; code: string; type: "ORIGIN" | "DESTINATION"; district: string },
): Promise<void> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM hubs WHERE code = ? LIMIT 1`,
    [input.code],
  )
  if (rows[0]) return

  await pool.execute(
    `INSERT INTO hubs (branch_id, name, code, type, district, status)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [branchId, input.name, input.code, input.type, input.district],
  )
}

async function ensureZone(input: { name: string; code: string }): Promise<string> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM zones WHERE code = ? LIMIT 1`,
    [input.code],
  )
  if (rows[0]) return String(rows[0].id)

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO zones (name, code, status) VALUES (?, ?, 'ACTIVE')`,
    [input.name, input.code],
  )
  return String(result.insertId)
}

async function ensurePricingRule(originZoneId: string, destinationZoneId: string): Promise<void> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM pricing_rules
      WHERE origin_zone_id = ? AND destination_zone_id = ?
        AND min_weight = 0 AND max_weight IS NULL AND status = 'ACTIVE'
      LIMIT 1`,
    [originZoneId, destinationZoneId],
  )
  if (rows[0]) return

  await pool.execute(
    `INSERT INTO pricing_rules
      (name, origin_zone_id, destination_zone_id, min_weight, max_weight,
       base_price, price_per_kg, cod_percentage, cod_fixed_fee, express_fee, status)
     VALUES (?, ?, ?, 0, NULL, 60, 20, 1.5, 20, 0, 'ACTIVE')`,
    [`${originZoneId}->${destinationZoneId} demo rate`, originZoneId, destinationZoneId],
  )
}

try {
  const branchId = await ensureBranch()
  await ensureHub(branchId, {
    name: "Dhaka Central Hub",
    code: "DPX-DHK",
    type: "ORIGIN",
    district: "Dhaka",
  })
  await ensureHub(branchId, {
    name: "Chattogram Central Hub",
    code: "DPX-CTG",
    type: "DESTINATION",
    district: "Chattogram",
  })

  const dhaka = await ensureZone({ name: "Dhaka", code: "DHAKA" })
  const chattogram = await ensureZone({ name: "Chattogram", code: "CTG" })
  await ensurePricingRule(dhaka, dhaka)
  await ensurePricingRule(dhaka, chattogram)
  await ensurePricingRule(chattogram, dhaka)
  await ensurePricingRule(chattogram, chattogram)

  console.log("✓ demo booking catalog is ready")
} finally {
  await pool.end()
}
