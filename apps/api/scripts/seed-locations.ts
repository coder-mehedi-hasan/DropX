#!/usr/bin/env bun
/**
 * Seeds the prepared city -> zone -> area catalog from the repository's
 * `locations.json` file.
 *
 * The source carries display names and pickup/delivery availability. Database
 * ids remain internal auto-increment keys, while stable uppercase codes are
 * derived from names and scoped by the schema's natural parent keys. Existing
 * rows are never overwritten, so administrator edits survive a re-run.
 */
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import mysql from "mysql2/promise"

type ServiceType = "ISD" | "SUBURB" | "OSD"
type Status = "ACTIVE" | "INACTIVE"

type SourceArea = {
  name: string
  pickup_available: boolean
  home_delivery_available: boolean
}

type SourceZone = {
  name: string
  areas: SourceArea[]
}

type SourceCity = {
  name: string
  service_type?: ServiceType
  zones: SourceZone[]
}

type PreparedArea = { name: string; code: string; status: Status }
type PreparedZone = { name: string; code: string; areas: PreparedArea[] }
type PreparedCity = {
  name: string
  code: string
  serviceType: ServiceType
  zones: PreparedZone[]
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const CATALOG_PATH = resolve(SCRIPT_DIR, "../../../locations.json")
const BATCH_SIZE = 500

/**
 * Pricing is city-based. The prepared catalog identifies Dhaka explicitly;
 * every other prepared city defaults to OSD. Add a city code here when the
 * business promotes it to a dedicated SUBURB pricing territory.
 */
const SERVICE_TYPE_BY_CITY_CODE: Readonly<Record<string, ServiceType>> = {
  DHAKA: "ISD",
}

function cleanName(value: unknown, path: string): string {
  if (typeof value !== "string") throw new Error(`${path} must be a string`)
  const name = value.trim().replace(/\s+/g, " ")
  if (!name) throw new Error(`${path} cannot be blank`)
  if (name.length > 100) throw new Error(`${path} exceeds 100 characters`)
  return name
}

function nameKey(name: string): string {
  return name.toLocaleLowerCase("en-US")
}

function baseCode(name: string): string {
  const code = name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return code || "LOCATION"
}

function uniqueCode(name: string, used: Set<string>): string {
  const base = baseCode(name).slice(0, 50).replace(/-+$/g, "") || "LOCATION"
  if (!used.has(base)) {
    used.add(base)
    return base
  }

  const suffix = createHash("sha256").update(name).digest("hex").slice(0, 8).toUpperCase()
  const code = `${base.slice(0, 41).replace(/-+$/g, "")}-${suffix}`
  if (used.has(code)) throw new Error(`Could not derive a unique code for ${name}`)
  used.add(code)
  return code
}

function parseCatalog(value: unknown): PreparedCity[] {
  if (!Array.isArray(value)) throw new Error("locations.json must contain an array of cities")

  const cityCodes = new Set<string>()
  const cityNames = new Set<string>()

  return value.map((rawCity, cityIndex) => {
    if (!rawCity || typeof rawCity !== "object") {
      throw new Error(`cities[${cityIndex}] must be an object`)
    }
    const city = rawCity as Partial<SourceCity>
    const name = cleanName(city.name, `cities[${cityIndex}].name`)
    const key = nameKey(name)
    if (cityNames.has(key)) throw new Error(`Duplicate city name: ${name}`)
    cityNames.add(key)
    if (!Array.isArray(city.zones)) throw new Error(`${name}.zones must be an array`)

    const code = uniqueCode(name, cityCodes)
    if (
      city.service_type !== undefined &&
      city.service_type !== "ISD" &&
      city.service_type !== "SUBURB" &&
      city.service_type !== "OSD"
    ) {
      throw new Error(`${name}.service_type must be ISD, SUBURB, or OSD`)
    }
    const zoneCodes = new Set<string>()
    const zoneNames = new Set<string>()
    const zones = city.zones.map((rawZone, zoneIndex) => {
      if (!rawZone || typeof rawZone !== "object") {
        throw new Error(`${name}.zones[${zoneIndex}] must be an object`)
      }
      const zone = rawZone as Partial<SourceZone>
      const zoneName = cleanName(zone.name, `${name}.zones[${zoneIndex}].name`)
      const zoneKey = nameKey(zoneName)
      if (zoneNames.has(zoneKey)) throw new Error(`Duplicate zone ${name} -> ${zoneName}`)
      zoneNames.add(zoneKey)
      if (!Array.isArray(zone.areas)) throw new Error(`${name}.${zoneName}.areas must be an array`)

      const areaCodes = new Set<string>()
      const areasByName = new Map<string, PreparedArea>()
      for (let areaIndex = 0; areaIndex < zone.areas.length; areaIndex += 1) {
        const rawArea = zone.areas[areaIndex]
        if (!rawArea || typeof rawArea !== "object") {
          throw new Error(`${name}.${zoneName}.areas[${areaIndex}] must be an object`)
        }
        const area = rawArea as Partial<SourceArea>
        const areaName = cleanName(area.name, `${name}.${zoneName}.areas[${areaIndex}].name`)
        if (
          typeof area.pickup_available !== "boolean" ||
          typeof area.home_delivery_available !== "boolean"
        ) {
          throw new Error(`${name}.${zoneName}.${areaName} must declare both availability flags`)
        }

        const areaKey = nameKey(areaName)
        // The catalog only retires an area when neither service is available.
        // Pickup-only and delivery-only areas remain selectable.
        const status: Status =
          area.pickup_available || area.home_delivery_available ? "ACTIVE" : "INACTIVE"
        const existing = areasByName.get(areaKey)
        if (existing) {
          if (status === "ACTIVE") existing.status = "ACTIVE"
          continue
        }
        areasByName.set(areaKey, {
          name: areaName,
          code: uniqueCode(areaName, areaCodes),
          status,
        })
      }

      return {
        name: zoneName,
        code: uniqueCode(zoneName, zoneCodes),
        areas: [...areasByName.values()],
      }
    })

    return {
      name,
      code,
      serviceType: city.service_type ?? SERVICE_TYPE_BY_CITY_CODE[code] ?? "OSD",
      zones,
    }
  })
}

function chunks<T>(values: readonly T[]): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += BATCH_SIZE) {
    result.push(values.slice(index, index + BATCH_SIZE))
  }
  return result
}

async function insertRows(
  connection: mysql.PoolConnection,
  table: "service_cities" | "service_zones" | "service_areas",
  columns: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): Promise<void> {
  for (const batch of chunks(rows)) {
    const values = batch.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ")
    await connection.execute(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values}
       ON DUPLICATE KEY UPDATE id = id`,
      batch.flat(),
    )
  }
}

async function seedCatalog(pool: mysql.Pool, catalog: PreparedCity[]): Promise<void> {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    await insertRows(
      connection,
      "service_cities",
      ["name", "code", "service_type", "status"],
      catalog.map((city) => [city.name, city.code, city.serviceType, "ACTIVE"]),
    )

    const [cityRows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT id, code FROM service_cities",
    )
    const cityIds = new Map(cityRows.map((row) => [String(row.code), String(row.id)]))
    const zones = catalog.flatMap((city) => {
      const cityId = cityIds.get(city.code)
      if (!cityId) throw new Error(`Seeded city ${city.code} was not found`)
      return city.zones.map((zone) => ({ ...zone, cityId }))
    })

    await insertRows(
      connection,
      "service_zones",
      ["city_id", "name", "code", "status"],
      zones.map((zone) => [zone.cityId, zone.name, zone.code, "ACTIVE"]),
    )

    const [zoneRows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT id, city_id, code FROM service_zones",
    )
    const zoneIds = new Map(
      zoneRows.map((row) => [`${String(row.city_id)}:${String(row.code)}`, String(row.id)]),
    )
    const areas = zones.flatMap((zone) => {
      const zoneId = zoneIds.get(`${zone.cityId}:${zone.code}`)
      if (!zoneId) throw new Error(`Seeded zone ${zone.cityId}/${zone.code} was not found`)
      return zone.areas.map((area) => ({ ...area, zoneId }))
    })

    await insertRows(
      connection,
      "service_areas",
      ["zone_id", "name", "code", "status"],
      areas.map((area) => [area.zoneId, area.name, area.code, area.status]),
    )

    await connection.commit()
    const activeAreas = areas.filter((area) => area.status === "ACTIVE").length
    console.log(
      `✓ locations ready — ${catalog.length} cities, ${zones.length} zones, ${areas.length} areas (${activeAreas} active)`,
    )
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function main(): Promise<void> {
  const source = JSON.parse(await readFile(CATALOG_PATH, "utf8")) as unknown
  const catalog = parseCatalog(source)
  const zoneCount = catalog.reduce((total, city) => total + city.zones.length, 0)
  const areas = catalog.flatMap((city) => city.zones.flatMap((zone) => zone.areas))
  const activeAreaCount = areas.filter((area) => area.status === "ACTIVE").length
  const serviceTypeCounts = { ISD: 0, SUBURB: 0, OSD: 0 }
  for (const city of catalog) serviceTypeCounts[city.serviceType] += 1

  if (process.argv.includes("--check")) {
    console.log(
      `✓ location catalog valid — ${catalog.length} cities, ${zoneCount} zones, ${areas.length} unique areas (${activeAreaCount} active); service types: ${serviceTypeCounts.ISD} ISD, ${serviceTypeCounts.SUBURB} SUBURB, ${serviceTypeCounts.OSD} OSD`,
    )
    return
  }

  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not set")

  const pool = mysql.createPool(DATABASE_URL)
  try {
    console.log(`· seeding locations from ${CATALOG_PATH}`)
    await seedCatalog(pool, catalog)
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error("✗ location seeding failed")
  console.error(error)
  process.exit(1)
})
