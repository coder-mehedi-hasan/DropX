#!/usr/bin/env bun
/**
 * Seeds a minimal realistic network: branches, hubs, routes, route stops, vehicles.
 * Idempotent by stable codes (re-running is safe).
 */
import mysql from "mysql2/promise"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set")

const pool = mysql.createPool(DATABASE_URL)

async function ensureBranch(input: {
  name: string
  code: string
  city: string
  district: string
  phone?: string | null
  address?: string | null
}): Promise<string> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM branches WHERE code = ? LIMIT 1`,
    [input.code],
  )
  if (rows[0]) return String(rows[0].id)

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO branches (name, code, city, district, phone, address, status)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [
      input.name,
      input.code,
      input.city,
      input.district,
      input.phone ?? null,
      input.address ?? null,
    ],
  )
  return String(result.insertId)
}

async function ensureHub(
  branchId: string,
  input: {
    name: string
    code: string
    type: "ORIGIN" | "SORTING" | "TRANSIT" | "DESTINATION"
    district: string
    address?: string | null
    capacity?: number | null
  },
): Promise<string> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM hubs WHERE code = ? LIMIT 1`,
    [input.code],
  )
  if (rows[0]) return String(rows[0].id)

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO hubs (branch_id, name, code, type, district, address, capacity, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [
      branchId,
      input.name,
      input.code,
      input.type,
      input.district,
      input.address ?? null,
      input.capacity ?? null,
    ],
  )
  return String(result.insertId)
}

async function ensureVehicle(input: {
  reg: string
  type: "BIKE" | "VAN" | "TRUCK" | "COVERED_VAN"
  capacityKg: number
}): Promise<string> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM vehicles WHERE registration_number = ? LIMIT 1`,
    [input.reg],
  )
  if (rows[0]) return String(rows[0].id)

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO vehicles (registration_number, type, capacity_kg, status)
     VALUES (?, ?, ?, 'AVAILABLE')`,
    [input.reg, input.type, input.capacityKg],
  )
  return String(result.insertId)
}

async function ensureRoute(input: {
  name: string
  code: string
  originHubId: string
  destHubId: string
  distanceKm?: number | null
  estMin?: number | null
}): Promise<string> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM routes WHERE code = ? LIMIT 1`,
    [input.code],
  )
  if (rows[0]) return String(rows[0].id)

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO routes (name, code, origin_hub_id, destination_hub_id, distance_km, estimated_minutes, status)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [
      input.name,
      input.code,
      input.originHubId,
      input.destHubId,
      input.distanceKm ?? null,
      input.estMin ?? null,
    ],
  )
  return String(result.insertId)
}

async function ensureRouteStops(
  routeId: string,
  stops: Array<{ hubId: string; seq: number; etaMin?: number | null }>,
) {
  // Clear and reinsert to keep sequence clean on re-run
  await pool.execute(`DELETE FROM route_stops WHERE route_id = ?`, [routeId])
  for (const s of stops) {
    await pool.execute(
      `INSERT INTO route_stops (route_id, hub_id, sequence_no, estimated_arrival_minutes)
       VALUES (?, ?, ?, ?)`,
      [routeId, s.hubId, s.seq, s.etaMin ?? null],
    )
  }
}

async function main() {
  const dhkBranch = await ensureBranch({
    name: "DropX Dhaka Branch",
    code: "DPX-DHK-BR",
    city: "Dhaka",
    district: "Dhaka",
    phone: "+880-2-XXXXXXX",
    address: "Dhaka HQ",
  })

  const ctgBranch = await ensureBranch({
    name: "DropX Chattogram Branch",
    code: "DPX-CTG-BR",
    city: "Chattogram",
    district: "Chattogram",
  })

  const khlBranch = await ensureBranch({
    name: "DropX Khulna Branch",
    code: "DPX-KHL-BR",
    city: "Khulna",
    district: "Khulna",
  })

  // Hubs
  const dhkCentral = await ensureHub(dhkBranch, {
    name: "Dhaka Central Sorting Hub",
    code: "HUB-DHK-CEN",
    type: "SORTING",
    district: "Dhaka",
    capacity: 5000,
  })
  const dhkPickup = await ensureHub(dhkBranch, {
    name: "Dhaka Pickup Hub",
    code: "HUB-DHK-PK",
    type: "ORIGIN",
    district: "Dhaka",
    capacity: 2000,
  })
  await ensureHub(dhkBranch, {
    name: "Dhaka Last-Mile Hub",
    code: "HUB-DHK-DL",
    type: "DESTINATION",
    district: "Dhaka",
    capacity: 1500,
  })

  const ctgCentral = await ensureHub(ctgBranch, {
    name: "Chattogram Central Sorting Hub",
    code: "HUB-CTG-CEN",
    type: "SORTING",
    district: "Chattogram",
    capacity: 4000,
  })
  await ensureHub(ctgBranch, {
    name: "Chattogram Pickup Hub",
    code: "HUB-CTG-PK",
    type: "ORIGIN",
    district: "Chattogram",
    capacity: 1500,
  })
  const ctgDelivery = await ensureHub(ctgBranch, {
    name: "Chattogram Last-Mile Hub",
    code: "HUB-CTG-DL",
    type: "DESTINATION",
    district: "Chattogram",
    capacity: 1200,
  })

  const khlCentral = await ensureHub(khlBranch, {
    name: "Khulna Central Sorting Hub",
    code: "HUB-KHL-CEN",
    type: "SORTING",
    district: "Khulna",
    capacity: 2000,
  })
  await ensureHub(khlBranch, {
    name: "Khulna Pickup Hub",
    code: "HUB-KHL-PK",
    type: "ORIGIN",
    district: "Khulna",
    capacity: 1000,
  })
  const khlDelivery = await ensureHub(khlBranch, {
    name: "Khulna Last-Mile Hub",
    code: "HUB-KHL-DL",
    type: "DESTINATION",
    district: "Khulna",
    capacity: 800,
  })

  // Vehicles
  await ensureVehicle({ reg: "DHK-MOTO-01", type: "BIKE", capacityKg: 15 })
  await ensureVehicle({ reg: "DHK-MOTO-02", type: "BIKE", capacityKg: 15 })
  await ensureVehicle({ reg: "DHK-VAN-01", type: "VAN", capacityKg: 500 })
  await ensureVehicle({ reg: "CTG-VAN-01", type: "VAN", capacityKg: 500 })
  await ensureVehicle({ reg: "KHL-VAN-01", type: "VAN", capacityKg: 350 })
  await ensureVehicle({ reg: "DHK-TRK-01", type: "TRUCK", capacityKg: 3000 })
  await ensureVehicle({ reg: "CTG-CV-01", type: "COVERED_VAN", capacityKg: 1500 })

  // Routes
  const rtDhkCtg = await ensureRoute({
    name: "Dhaka – Chattogram Linehaul",
    code: "RT-DHK-CTG",
    originHubId: dhkCentral,
    destHubId: ctgCentral,
    distanceKm: 265,
    estMin: 420,
  })
  await ensureRouteStops(rtDhkCtg, [
    { hubId: dhkPickup, seq: 1, etaMin: 0 },
    { hubId: dhkCentral, seq: 2, etaMin: 30 },
    { hubId: ctgCentral, seq: 3, etaMin: 390 },
    { hubId: ctgDelivery, seq: 4, etaMin: 420 },
  ])

  const rtDhkKhl = await ensureRoute({
    name: "Dhaka – Khulna Linehaul",
    code: "RT-DHK-KHL",
    originHubId: dhkCentral,
    destHubId: khlCentral,
    distanceKm: 215,
    estMin: 330,
  })
  await ensureRouteStops(rtDhkKhl, [
    { hubId: dhkCentral, seq: 1, etaMin: 0 },
    { hubId: khlCentral, seq: 2, etaMin: 300 },
    { hubId: khlDelivery, seq: 3, etaMin: 330 },
  ])

  const rtCtgDhk = await ensureRoute({
    name: "Chattogram – Dhaka Return",
    code: "RT-CTG-DHK",
    originHubId: ctgCentral,
    destHubId: dhkCentral,
    distanceKm: 265,
    estMin: 420,
  })
  await ensureRouteStops(rtCtgDhk, [
    { hubId: ctgCentral, seq: 1, etaMin: 0 },
    { hubId: dhkCentral, seq: 2, etaMin: 390 },
  ])

  console.log("✓ network seed ready (branches/hubs/routes/stops/vehicles)")
}

main()
  .catch((e) => {
    console.error("✗ network seed failed", e)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
  })
