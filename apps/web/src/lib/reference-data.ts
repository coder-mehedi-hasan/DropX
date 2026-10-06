/**
 * Booking reference data.
 *
 * These endpoints are mounted on the customer surface, so the API checks the
 * ACTIVE OTP session before exposing any route or options.
 *
 * The location cascade mirrors the hierarchy the pricing matrix keys on:
 * city → zone → area. Ordering makes it safe to drive three cascading selects
 * without inventing a path segment on the client — every response carries the
 * id the next level is fetched with.
 */

import { apiRequest } from "@/lib/api-client"

export type ReferenceOption = {
  id: string
  label: string
  description?: string
}

export type ReferenceSource = "hubs" | "cities" | "city-zones" | "zone-areas"

/** Named so the UI can say which endpoint is missing instead of guessing. */
export const REFERENCE_ENDPOINTS: Readonly<Record<ReferenceSource, string>> = {
  hubs: "GET /api/v1/customer/reference/hubs",
  cities: "GET /api/v1/customer/locations/cities",
  "city-zones": "GET /api/v1/customer/locations/cities/:cityId/zones",
  "zone-areas": "GET /api/v1/customer/locations/zones/:zoneId/areas",
}

const LIST_REFERENCE_QUERY = { limit: 100, sortBy: "name", sort: "asc" } as const

export async function listHubs(): Promise<ReferenceOption[]> {
  const page = await apiRequest<{
    nodes: Array<{ id: string; name: string; code: string; district: string | null }>
    meta: unknown
  }>("/customer/reference/hubs", { query: LIST_REFERENCE_QUERY })
  return page.nodes.map((hub) => ({
    id: hub.id,
    label: `${hub.name} (${hub.code})`,
    description: hub.district ?? undefined,
  }))
}

export async function listCities(): Promise<ReferenceOption[]> {
  const page = await apiRequest<{
    nodes: Array<{ id: string; name: string; code: string; serviceType: string }>
    meta: unknown
  }>("/customer/locations/cities", { query: LIST_REFERENCE_QUERY })
  return page.nodes.map((city) => ({
    id: city.id,
    label: `${city.name} (${city.code})`,
    description: `${city.serviceType} service`,
  }))
}

export async function listCityZones(cityId: string): Promise<ReferenceOption[]> {
  const page = await apiRequest<{
    nodes: Array<{ id: string; name: string; code: string; cityId: string }>
    meta: unknown
  }>(`/customer/locations/cities/${encodeURIComponent(cityId)}/zones`, {
    query: LIST_REFERENCE_QUERY,
  })
  return page.nodes.map((zone) => ({ id: zone.id, label: `${zone.name} (${zone.code})` }))
}

export async function listZoneAreas(zoneId: string): Promise<ReferenceOption[]> {
  const page = await apiRequest<{
    nodes: Array<{ id: string; name: string; code: string; zoneId: string }>
    meta: unknown
  }>(`/customer/locations/zones/${encodeURIComponent(zoneId)}/areas`, {
    query: LIST_REFERENCE_QUERY,
  })
  return page.nodes.map((area) => ({ id: area.id, label: `${area.name} (${area.code})` }))
}
