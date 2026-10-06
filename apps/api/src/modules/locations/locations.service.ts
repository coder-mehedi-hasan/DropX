import type { Context } from "hono"

import { buildPage, normalizeListParams, type Page } from "../../db/models"
import type { ServiceArea, ServiceCity, ServiceZone } from "../../db/models"
import { DomainError, ERROR_CODES, fromDatabaseError, notFound } from "../../core"
import type { AppEnv } from "../../types/env"

import type {
  CreateServiceAreaInput,
  CreateServiceCityInput,
  CreateServiceZoneInput,
  ListServiceAreasQuery,
  ListServiceCitiesQuery,
  ListServiceZonesQuery,
} from "./locations.dto"
import {
  codeExistsUnderParent,
  insertServiceArea,
  insertServiceCity,
  insertServiceZone,
  patchServiceArea,
  patchServiceCity,
  patchServiceZone,
  selectServiceArea,
  selectServiceAreas,
  selectServiceCity,
  selectServiceCities,
  selectServiceZone,
  selectServiceZones,
} from "./locations.repository"

/**
 * The location service: territory administration, and the one place a
 * city/zone/area triple is turned into a resolved address.
 *
 * Two rules run through every function here:
 *
 * 1. **The parent relationship is re-checked server-side.** A client that
 *    skipped the cascade can send a zone that belongs to another city; the
 *    cascade in the UI is a convenience, not a control.
 * 2. **Inactive rows are hidden from customers, never deleted.** Deactivation
 *    is how a location is retired — a historical parcel keeps its snapshot and
 *    its foreign key, so deleting a zone would either fail or lie.
 */

function validationError(field: string, message: string): DomainError {
  return new DomainError(ERROR_CODES.VALIDATION_FAILED, message, {
    details: [{ field, message }],
  })
}

// --- Cities -----------------------------------------------------------------

export async function listServiceCities(
  c: Context<AppEnv>,
  query: ListServiceCitiesQuery,
): Promise<Page<ServiceCity>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectServiceCities(c.get("db")!, params, {
    status: query.status,
    serviceType: query.serviceType,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getServiceCity(c: Context<AppEnv>, cityId: string): Promise<ServiceCity> {
  const city = await selectServiceCity(c.get("db")!, cityId)
  if (!city) throw notFound("No such city")
  return city
}

export async function createServiceCity(
  c: Context<AppEnv>,
  input: CreateServiceCityInput,
): Promise<ServiceCity> {
  try {
    const id = await insertServiceCity(c.get("db")!, {
      name: input.name,
      code: input.code,
      serviceType: input.serviceType,
      status: input.status,
    })
    return await getServiceCity(c, id)
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A city with that code")
  }
}

export async function updateServiceCity(
  c: Context<AppEnv>,
  cityId: string,
  patch: Partial<CreateServiceCityInput>,
): Promise<ServiceCity> {
  try {
    if (patch.code) {
      const taken = await codeExistsUnderParent(c.get("db")!, "service_cities", {}, patch.code, cityId)
      if (taken) {
        throw new DomainError(ERROR_CODES.ALREADY_EXISTS, "A city with that code already exists", {
          details: [{ field: "code", message: "Pick a different code" }],
        })
      }
    }
    const city = await patchServiceCity(c.get("db")!, cityId, patch)
    if (!city) throw notFound("No such city")
    return city
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A city with that code")
  }
}

// --- Zones ------------------------------------------------------------------

export async function listServiceZones(
  c: Context<AppEnv>,
  query: ListServiceZonesQuery,
): Promise<Page<ServiceZone>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectServiceZones(c.get("db")!, params, {
    cityId: query.cityId,
    status: query.status,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getServiceZone(c: Context<AppEnv>, zoneId: string): Promise<ServiceZone> {
  const zone = await selectServiceZone(c.get("db")!, zoneId)
  if (!zone) throw notFound("No such zone")
  return zone
}

export async function createServiceZone(
  c: Context<AppEnv>,
  input: CreateServiceZoneInput,
): Promise<ServiceZone> {
  const city = await selectServiceCity(c.get("db")!, input.cityId)
  if (!city) {
    throw validationError("cityId", "Pick an existing city")
  }

  try {
    const id = await insertServiceZone(c.get("db")!, {
      cityId: input.cityId,
      name: input.name,
      code: input.code,
      status: input.status,
    })
    return await getServiceZone(c, id)
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A zone with that code")
  }
}

export async function updateServiceZone(
  c: Context<AppEnv>,
  zoneId: string,
  patch: Partial<CreateServiceZoneInput>,
): Promise<ServiceZone> {
  try {
    const existing = await getServiceZone(c, zoneId)
    const cityId = patch.cityId ?? existing.cityId

    if (patch.cityId) {
      const city = await selectServiceCity(c.get("db")!, patch.cityId)
      if (!city) throw validationError("cityId", "Pick an existing city")
    }
    if (patch.code) {
      const taken = await codeExistsUnderParent(
        c.get("db")!,
        "service_zones",
        { cityId },
        patch.code,
        zoneId,
      )
      if (taken) {
        throw new DomainError(ERROR_CODES.ALREADY_EXISTS, "A zone with that code already exists", {
          details: [{ field: "code", message: "Pick a different code" }],
        })
      }
    }

    const zone = await patchServiceZone(c.get("db")!, zoneId, patch)
    if (!zone) throw notFound("No such zone")
    return zone
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A zone with that code")
  }
}

// --- Areas ------------------------------------------------------------------

export async function listServiceAreas(
  c: Context<AppEnv>,
  query: ListServiceAreasQuery,
): Promise<Page<ServiceArea>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectServiceAreas(c.get("db")!, params, {
    zoneId: query.zoneId,
    status: query.status,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getServiceArea(c: Context<AppEnv>, areaId: string): Promise<ServiceArea> {
  const area = await selectServiceArea(c.get("db")!, areaId)
  if (!area) throw notFound("No such area")
  return area
}

export async function createServiceArea(
  c: Context<AppEnv>,
  input: CreateServiceAreaInput,
): Promise<ServiceArea> {
  const zone = await selectServiceZone(c.get("db")!, input.zoneId)
  if (!zone) throw validationError("zoneId", "Pick an existing zone")

  try {
    const id = await insertServiceArea(c.get("db")!, {
      zoneId: input.zoneId,
      name: input.name,
      code: input.code,
      status: input.status,
    })
    return await getServiceArea(c, id)
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "An area with that code")
  }
}

export async function updateServiceArea(
  c: Context<AppEnv>,
  areaId: string,
  patch: Partial<CreateServiceAreaInput>,
): Promise<ServiceArea> {
  try {
    const existing = await getServiceArea(c, areaId)
    const zoneId = patch.zoneId ?? existing.zoneId

    if (patch.zoneId) {
      const zone = await selectServiceZone(c.get("db")!, patch.zoneId)
      if (!zone) throw validationError("zoneId", "Pick an existing zone")
    }
    if (patch.code) {
      const taken = await codeExistsUnderParent(
        c.get("db")!,
        "service_areas",
        { zoneId },
        patch.code,
        areaId,
      )
      if (taken) {
        throw new DomainError(ERROR_CODES.ALREADY_EXISTS, "An area with that code already exists", {
          details: [{ field: "code", message: "Pick a different code" }],
        })
      }
    }

    const area = await patchServiceArea(c.get("db")!, areaId, patch)
    if (!area) throw notFound("No such area")
    return area
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "An area with that code")
  }
}

// --- Customer reference -----------------------------------------------------

/** The cascade's first hop. Inactive cities are never served to a customer. */
export async function listCitiesForCustomer(
  c: Context<AppEnv>,
  query: { page: number; limit: number; sort: "asc" | "desc"; search?: string | undefined },
): Promise<Page<ServiceCity>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectServiceCities(c.get("db")!, params, {
    status: "ACTIVE",
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function listZonesForCity(
  c: Context<AppEnv>,
  cityId: string,
  query: { page: number; limit: number; sort: "asc" | "desc"; search?: string | undefined },
): Promise<Page<ServiceZone>> {
  // A 404 for the parent, not an empty page: an empty page reads as "this city
  // has no zones yet", which sends a client back to the city picker to retry a
  // path segment that was simply wrong.
  const city = await selectServiceCity(c.get("db")!, cityId)
  if (!city) throw notFound("No such city")

  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectServiceZones(c.get("db")!, params, {
    cityId,
    status: "ACTIVE",
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function listAreasForZone(
  c: Context<AppEnv>,
  zoneId: string,
  query: { page: number; limit: number; sort: "asc" | "desc"; search?: string | undefined },
): Promise<Page<ServiceArea>> {
  const zone = await selectServiceZone(c.get("db")!, zoneId)
  if (!zone) throw notFound("No such zone")

  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectServiceAreas(c.get("db")!, params, {
    zoneId,
    status: "ACTIVE",
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

// --- Address resolution ------------------------------------------------------

export type ResolvedAddress = {
  city: ServiceCity
  zone: ServiceZone
  area: ServiceArea | null
}

/**
 * Turns the three ids a client was handed into the row set a booking stores.
 *
 * This is the only validation the quote and the parcel writer share: both need
 * to know that the zone really belongs to the city, that the area really
 * belongs to the zone, and that none of them has been deactivated since the
 * picker loaded. Failing here names the offending field, so the form can point
 * at the cascade step that went stale rather than at the whole address.
 */
export async function resolveAddress(
  c: Context<AppEnv>,
  input: { cityId: string; zoneId: string; areaId?: string | undefined },
): Promise<ResolvedAddress> {
  const db = c.get("db")!

  const city = await selectServiceCity(db, input.cityId)
  if (!city) throw validationError("cityId", "Pick a city from the list")
  if (city.status !== "ACTIVE") {
    throw validationError("cityId", "That city is not accepting bookings")
  }

  const zone = await selectServiceZone(db, input.zoneId)
  if (!zone) throw validationError("zoneId", "Pick a zone from the list")
  if (zone.cityId !== city.id) {
    throw validationError("zoneId", "That zone does not belong to the selected city")
  }
  if (zone.status !== "ACTIVE") {
    throw validationError("zoneId", "That zone is not accepting bookings")
  }

  let area: ServiceArea | null = null
  if (input.areaId) {
    area = await selectServiceArea(db, input.areaId)
    if (!area) throw validationError("areaId", "Pick an area from the list")
    if (area.zoneId !== zone.id) {
      throw validationError("areaId", "That area does not belong to the selected zone")
    }
    if (area.status !== "ACTIVE") {
      throw validationError("areaId", "That area is not accepting bookings")
    }
  }

  return { city, zone, area }
}

/** The same three rows, without the booking-time strictness — a read-only view. */
export async function findLocationTriple(
  c: Context<AppEnv>,
  input: { cityId: string; zoneId: string; areaId?: string | undefined },
): Promise<ResolvedAddress | null> {
  const db = c.get("db")!
  const city = await selectServiceCity(db, input.cityId)
  const zone = await selectServiceZone(db, input.zoneId)
  if (!city || !zone) return null
  const area = input.areaId ? await selectServiceArea(db, input.areaId) : null
  return { city, zone, area }
}
