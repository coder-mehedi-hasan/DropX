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
  /**
   * The row's own fields, for screens that show them apart from the label —
   * the coverage explorer badges the code and spells out the service type
   * instead of repeating the composed `label` string.
   */
  name?: string
  code?: string
  serviceType?: string
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
    name: hub.name,
    code: hub.code,
  }))
}

export async function listCities(): Promise<ReferenceOption[]> {
  const page = await apiRequest<{
    nodes: Array<{ id: string; name: string; code: string; serviceType: string }>
    meta: unknown
  }>("/customer/locations/cities", { query: LIST_REFERENCE_QUERY })
  return page.nodes.map((city) => ({
    id: city.id,
    label: `${city.name}`,
    // description: city.code,
    name: city.name,
    code: city.code,
    serviceType: city.serviceType,
  }))
}

export async function listCityZones(cityId: string): Promise<ReferenceOption[]> {
  const page = await apiRequest<{
    nodes: Array<{ id: string; name: string; code: string; cityId: string }>
    meta: unknown
  }>(`/customer/locations/cities/${encodeURIComponent(cityId)}/zones`, {
    query: LIST_REFERENCE_QUERY,
  })
  return page.nodes.map((zone) => ({
    id: zone.id,
    label: zone.name,
    name: zone.name,
    code: zone.code,
  }))
}

export async function listZoneAreas(zoneId: string): Promise<ReferenceOption[]> {
  const page = await apiRequest<{
    nodes: Array<{ id: string; name: string; code: string; zoneId: string }>
    meta: unknown
  }>(`/customer/locations/zones/${encodeURIComponent(zoneId)}/areas`, {
    query: LIST_REFERENCE_QUERY,
  })
  return page.nodes.map((area) => ({
    id: area.id,
    label: area.name,
    name: area.name,
    code: area.code,
  }))
}
