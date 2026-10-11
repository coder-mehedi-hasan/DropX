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
    services: Array<"PICKUP" | "SORTING" | "DELIVERY">
    district: string
    address?: string | null
    capacity?: number | null
  },
): Promise<string> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM hubs WHERE code = ? LIMIT 1`,
    [input.code],
  )
  let hubId: string
  if (rows[0]) {
    hubId = String(rows[0].id)
    await pool.execute(
      `UPDATE hubs
       SET branch_id = ?, name = ?, district = ?, address = ?, capacity = ?, status = 'ACTIVE'
       WHERE id = ?`,
      [branchId, input.name, input.district, input.address ?? null, input.capacity ?? null, hubId],
    )
  } else {
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO hubs (branch_id, name, code, district, address, capacity, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        branchId,
        input.name,
        input.code,
        input.district,
        input.address ?? null,
        input.capacity ?? null,
      ],
    )
    hubId = String(result.insertId)
  }

  await pool.execute("DELETE FROM hub_services WHERE hub_id = ?", [hubId])
  for (const service of input.services) {
    await pool.execute("INSERT INTO hub_services (hub_id, service) VALUES (?, ?)", [hubId, service])
  }
  return hubId
}

/**
 * The original demo network represented pickup, sorting, and delivery as
 * separate physical hubs. Consolidate those known seed rows into the city's
 * central hub before deleting them. All references move in one transaction so
 * a failed cleanup cannot leave half of the network on the old model.
 */
async function consolidateLegacyDemoHubs(
  mappings: Array<{ legacyCode: string; centralHubId: string }>,
): Promise<number> {
  const connection = await pool.getConnection()
  let removed = 0

  try {
    await connection.beginTransaction()

    for (const mapping of mappings) {
      const [hubRows] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT id FROM hubs WHERE code = ? LIMIT 1 FOR UPDATE`,
        [mapping.legacyCode],
      )
      if (!hubRows[0]) continue

      const legacyHubId = String(hubRows[0].id)

      // A pickup-hub -> central-hub demo transfer becomes a self-transfer after
      // consolidation. It is safe to remove only while it is still an empty,
      // planned draft; anything operational or historical must stop the seed.
      const [sameHubTransfers] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT t.id, t.transfer_number, t.status,
                EXISTS(SELECT 1 FROM transfer_parcels tp WHERE tp.transfer_id = t.id) AS has_parcels
         FROM transfers t
         WHERE (t.from_hub_id = ? AND t.to_hub_id = ?)
            OR (t.from_hub_id = ? AND t.to_hub_id = ?)
         FOR UPDATE`,
        [legacyHubId, mapping.centralHubId, mapping.centralHubId, legacyHubId],
      )
      const unsafeTransfer = sameHubTransfers.find(
        (row) => row.status !== "PLANNED" || Number(row.has_parcels) !== 0,
      )
      if (unsafeTransfer) {
        throw new Error(
          `Cannot consolidate ${mapping.legacyCode}: transfer ${unsafeTransfer.transfer_number} has operational history`,
        )
      }
      if (sameHubTransfers.length > 0) {
        await connection.query(
          `DELETE FROM transfers WHERE id IN (${sameHubTransfers.map(() => "?").join(", ")})`,
          [sameHubTransfers.map((row) => String(row.id))].flat(),
        )
      }

      const [sameHubRoutes] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT code
         FROM routes
         WHERE (origin_hub_id = ? AND destination_hub_id = ?)
            OR (origin_hub_id = ? AND destination_hub_id = ?)
         LIMIT 1
         FOR UPDATE`,
        [legacyHubId, mapping.centralHubId, mapping.centralHubId, legacyHubId],
      )
      if (sameHubRoutes[0]) {
        throw new Error(
          `Cannot consolidate ${mapping.legacyCode}: route ${sameHubRoutes[0].code} would become a self-route`,
        )
      }

      // Composite keys need conflict-safe consolidation before ordinary FK
      // columns can be updated directly.
      await connection.execute(
        `INSERT IGNORE INTO user_hubs (user_id, hub_id)
         SELECT user_id, ? FROM user_hubs WHERE hub_id = ?`,
        [mapping.centralHubId, legacyHubId],
      )
      await connection.execute(`DELETE FROM user_hubs WHERE hub_id = ?`, [legacyHubId])

      await connection.execute(
        `DELETE old_stop
         FROM route_stops old_stop
         JOIN route_stops central_stop
           ON central_stop.route_id = old_stop.route_id AND central_stop.hub_id = ?
         WHERE old_stop.hub_id = ?`,
        [mapping.centralHubId, legacyHubId],
      )

      const references = [
        ["parcels", "origin_hub_id"],
        ["parcels", "destination_hub_id"],
        ["parcels", "current_hub_id"],
        ["routes", "origin_hub_id"],
        ["routes", "destination_hub_id"],
        ["route_stops", "hub_id"],
        ["riders", "hub_id"],
        ["transfers", "from_hub_id"],
        ["transfers", "to_hub_id"],
        ["deliveries", "hub_id"],
        ["parcel_events", "hub_id"],
      ] as const

      for (const [table, column] of references) {
        await connection.execute(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, [
          mapping.centralHubId,
          legacyHubId,
        ])
      }

      await connection.execute(`DELETE FROM hubs WHERE id = ?`, [legacyHubId])
      removed += 1
    }

    await connection.commit()
    return removed
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
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
  if (rows[0]) {
    const routeId = String(rows[0].id)
    await pool.execute(
      `UPDATE routes
       SET name = ?, origin_hub_id = ?, destination_hub_id = ?, distance_km = ?,
           estimated_minutes = ?, status = 'ACTIVE'
       WHERE id = ?`,
      [
        input.name,
        input.originHubId,
        input.destHubId,
        input.distanceKm ?? null,
        input.estMin ?? null,
        routeId,
      ],
    )
    return routeId
  }

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

  // One physical hub per city, each configured with the services it provides.
  const dhkCentral = await ensureHub(dhkBranch, {
    name: "Dhaka Hub",
    code: "HUB-DHK-CEN",
    services: ["PICKUP", "SORTING", "DELIVERY"],
    district: "Dhaka",
    capacity: 5000,
  })

  const ctgCentral = await ensureHub(ctgBranch, {
    name: "Chattogram Hub",
    code: "HUB-CTG-CEN",
    services: ["PICKUP", "SORTING", "DELIVERY"],
    district: "Chattogram",
    capacity: 4000,
  })

  const khlCentral = await ensureHub(khlBranch, {
    name: "Khulna Hub",
    code: "HUB-KHL-CEN",
    services: ["PICKUP", "SORTING", "DELIVERY"],
    district: "Khulna",
    capacity: 2000,
  })

  const removedLegacyHubs = await consolidateLegacyDemoHubs([
    { legacyCode: "HUB-DHK-PK", centralHubId: dhkCentral },
    { legacyCode: "HUB-DHK-DL", centralHubId: dhkCentral },
    { legacyCode: "HUB-CTG-PK", centralHubId: ctgCentral },
    { legacyCode: "HUB-CTG-DL", centralHubId: ctgCentral },
    { legacyCode: "HUB-KHL-PK", centralHubId: khlCentral },
    { legacyCode: "HUB-KHL-DL", centralHubId: khlCentral },
  ])

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
    { hubId: dhkCentral, seq: 1, etaMin: 0 },
    { hubId: ctgCentral, seq: 2, etaMin: 420 },
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
    { hubId: khlCentral, seq: 2, etaMin: 330 },
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

  console.log(
    `✓ network seed ready (branches/hubs/routes/stops/vehicles; removed ${removedLegacyHubs} legacy hubs)`,
  )
}

main()
  .catch((e) => {
    console.error("✗ network seed failed", e)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
  })
