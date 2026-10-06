import { z } from "zod"

import {
  LOCATION_SERVICE_TYPES,
  RECORD_STATUSES,
} from "../../db/models"

/**
 * Boundary DTOs for the city → zone → area hierarchy.
 *
 * Two shapes live here on purpose, and they are deliberately not the same
 * schema with a flag on it:
 *
 * - **Admin** inputs carry a parent id and a status, because staff are
 *   configuring territory. Sort keys are an allowlist, because they reach SQL.
 * - **Customer reference** outputs are narrow projections of active rows, with
 *   the parent id the next request in the cascade is built from.
 *
 * Nothing here is a free-text location: `cityId`/`zoneId` are ids the client
 * was given, never a name it typed, and the service re-checks the parent-child
 * relationship server-side because a client that skipped the cascade is exactly
 * the client that will send a zone from another city.
 */

const id = z.string().trim().min(1)
const name = z.string().trim().min(1).max(100)
const code = z.string().trim().min(1).max(50)

const upperCode = code.refine((value) => /^[A-Z0-9-]+$/.test(value), {
  message: "Use uppercase letters, numbers and hyphens only",
})

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["asc", "desc"]).default("asc"),
  search: z.string().trim().max(100).optional(),
})

// --- Admin: list queries ----------------------------------------------------

export const listServiceCitiesQuerySchema = listQuery.extend({
  sortBy: z.enum(["name", "code", "serviceType", "status", "createdAt"]).default("name"),
  status: z.enum(RECORD_STATUSES).optional(),
  serviceType: z.enum(LOCATION_SERVICE_TYPES).optional(),
})

export const listServiceZonesQuerySchema = listQuery.extend({
  sortBy: z.enum(["name", "code", "status", "createdAt"]).default("name"),
  cityId: id.optional(),
  status: z.enum(RECORD_STATUSES).optional(),
})

export const listServiceAreasQuerySchema = listQuery.extend({
  sortBy: z.enum(["name", "code", "status", "createdAt"]).default("name"),
  zoneId: id.optional(),
  status: z.enum(RECORD_STATUSES).optional(),
})

export type ListServiceCitiesQuery = z.infer<typeof listServiceCitiesQuerySchema>
export type ListServiceZonesQuery = z.infer<typeof listServiceZonesQuerySchema>
export type ListServiceAreasQuery = z.infer<typeof listServiceAreasQuerySchema>

// --- Admin: params ----------------------------------------------------------

export const serviceCityIdParamSchema = z.object({ id })
export const serviceZoneIdParamSchema = z.object({ id })
export const serviceAreaIdParamSchema = z.object({ id })

// --- Admin: write bodies ----------------------------------------------------

export const createServiceCitySchema = z.object({
  name,
  code: upperCode,
  serviceType: z.enum(LOCATION_SERVICE_TYPES).default("ISD"),
  status: z.enum(RECORD_STATUSES).default("ACTIVE"),
})

export type CreateServiceCityInput = z.infer<typeof createServiceCitySchema>

export const updateServiceCitySchema = createServiceCitySchema.partial()

export const createServiceZoneSchema = z.object({
  cityId: id,
  name,
  code: upperCode,
  status: z.enum(RECORD_STATUSES).default("ACTIVE"),
})

export type CreateServiceZoneInput = z.infer<typeof createServiceZoneSchema>

export const updateServiceZoneSchema = createServiceZoneSchema.partial()

export const createServiceAreaSchema = z.object({
  zoneId: id,
  name,
  code: upperCode,
  status: z.enum(RECORD_STATUSES).default("ACTIVE"),
})

export type CreateServiceAreaInput = z.infer<typeof createServiceAreaSchema>

export const updateServiceAreaSchema = createServiceAreaSchema.partial()

// --- Admin: responses -------------------------------------------------------

export const serviceCityResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  serviceType: z.enum(LOCATION_SERVICE_TYPES),
  status: z.enum(RECORD_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const serviceZoneResponseSchema = z.object({
  id: z.string(),
  cityId: z.string(),
  name: z.string(),
  code: z.string(),
  status: z.enum(RECORD_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const serviceAreaResponseSchema = z.object({
  id: z.string(),
  zoneId: z.string(),
  name: z.string(),
  code: z.string(),
  status: z.enum(RECORD_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

// --- Customer reference -----------------------------------------------------

export const listCitiesQuerySchema = listQuery.extend({
  sortBy: z.enum(["name", "code", "serviceType"]).default("name"),
})

export const cityZonesParamSchema = z.object({ cityId: id })
export const zoneAreasParamSchema = z.object({ zoneId: id })

export const listCityZonesQuerySchema = listQuery.extend({
  sortBy: z.enum(["name", "code"]).default("name"),
})

export const listZoneAreasQuerySchema = listQuery.extend({
  sortBy: z.enum(["name", "code"]).default("name"),
})

/**
 * The cascade contract, in one place: each response carries the id the next
 * level is fetched with, so a client never has to invent a path segment.
 *
 * Status is omitted on purpose. Only `ACTIVE` rows are ever served here, so
 * including it would promise a distinction the endpoint cannot make.
 */
export const cityRefResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  serviceType: z.enum(LOCATION_SERVICE_TYPES),
})

export const zoneRefResponseSchema = z.object({
  id: z.string(),
  cityId: z.string(),
  name: z.string(),
  code: z.string(),
})

export const areaRefResponseSchema = z.object({
  id: z.string(),
  zoneId: z.string(),
  name: z.string(),
  code: z.string(),
})
