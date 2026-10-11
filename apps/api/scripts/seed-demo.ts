#!/usr/bin/env bun
/**
 * Seeds the minimum operational catalog needed to try customer booking locally.
 *
 * This is intentionally separate from `db:seed`: production role seeding should
 * not create fictional branches, hubs, or prices. Every lookup is by a
 * stable code/name, so running this repeatedly is safe.
 *
 * Locations and the pricing matrix are seeded by `seed:pricing`; this script
 * adds the branches and hubs a demo booking runs between.
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
  input: { name: string; code: string; district: string },
): Promise<void> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM hubs WHERE code = ? LIMIT 1`,
    [input.code],
  )
  let hubId: string
  if (rows[0]) {
    hubId = String(rows[0].id)
  } else {
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO hubs (branch_id, name, code, district, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [branchId, input.name, input.code, input.district],
    )
    hubId = String(result.insertId)
  }

  await pool.execute("DELETE FROM hub_services WHERE hub_id = ?", [hubId])
  for (const service of ["PICKUP", "SORTING", "DELIVERY"] as const) {
    await pool.execute("INSERT INTO hub_services (hub_id, service) VALUES (?, ?)", [hubId, service])
  }
}

try {
  const branchId = await ensureBranch()
  await ensureHub(branchId, {
    name: "Dhaka Central Hub",
    code: "DPX-DHK",
    district: "Dhaka",
  })
  await ensureHub(branchId, {
    name: "Chattogram Central Hub",
    code: "DPX-CTG",
    district: "Chattogram",
  })

  console.log("✓ demo booking catalog is ready")
} finally {
  await pool.end()
}
