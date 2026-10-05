import { z } from "zod"

import { RECORD_STATUSES } from "../../db/models"

const id = z.string().trim().min(1)
/**
 * Two shapes on purpose. `recordStatus` has no `.default()`, so an absent field
 * stays absent — used by the list filter and by PATCH, where defaulting would
 * silently rewrite a record the caller never mentioned. `createStatus` is the
 * one that may invent a value, and only for create.
 */
const recordStatus = z.enum(RECORD_STATUSES)
const createStatus = recordStatus.default("ACTIVE")

export const listRoutesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "code", "status", "createdAt"]).default("name"),
  sort: z.enum(["asc", "desc"]).default("asc"),
  status: recordStatus.or(z.literal("")).optional(),
  search: z.string().trim().max(100).optional(),
})
export type ListRoutesQuery = z.infer<typeof listRoutesQuerySchema>

export const routeIdParamSchema = z.object({ id })

/**
 * The field set, kept unrefined so `.partial()` and `.omit()` still work on it —
 * Zod 4 refuses both on a schema that carries a refinement. The cross-field
 * check below is applied separately to create and to update.
 */
const routeFields = {
  name: z.string().trim().min(1).max(150),
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .refine((v) => /^[A-Z0-9-]+$/.test(v), {
      message: "Use uppercase letters, numbers and hyphens only",
    }),
  originHubId: id,
  destinationHubId: id,
  distanceKm: z.coerce.number().nonnegative().max(99999).nullish(),
  estimatedMinutes: z.coerce.number().int().nonnegative().max(99999).nullish(),
}

/** A route is a loop unless its two hubs differ, so reject it at the boundary. */
const hubsDiffer = (v: { originHubId?: string; destinationHubId?: string }) =>
  !v.originHubId || !v.destinationHubId || v.originHubId !== v.destinationHubId

export const createRouteSchema = z
  .object({ ...routeFields, status: createStatus })
  .refine(hubsDiffer, {
    message: "Origin and destination hub must differ",
    path: ["destinationHubId"],
  })
export type CreateRouteInput = z.infer<typeof createRouteSchema>

/**
 * Partial on purpose: a PATCH carries only what changed. `status` is re-declared
 * without its create-time default so omitting it cannot reset the stored value.
 */
export const updateRouteSchema = z
  .object(routeFields)
  .partial()
  .extend({ status: recordStatus.optional() })
  .refine(hubsDiffer, {
    message: "Origin and destination hub must differ",
    path: ["destinationHubId"],
  })
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>

export const routeStopInputSchema = z.object({
  hubId: id,
  sequenceNo: z.coerce.number().int().min(1),
  estimatedArrivalMinutes: z.coerce.number().int().nonnegative().max(99999).nullish(),
})
export type RouteStopInput = z.infer<typeof routeStopInputSchema>

export const updateStopsSchema = z.object({
  stops: z.array(routeStopInputSchema).max(200),
})
export type UpdateStopsInput = z.infer<typeof updateStopsSchema>

export const routeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  originHubId: z.string(),
  destinationHubId: z.string(),
  distanceKm: z.number().nullable(),
  estimatedMinutes: z.number().nullable(),
  status: z.enum(RECORD_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type RouteResponse = z.infer<typeof routeResponseSchema>

export const routeStopResponseSchema = z.object({
  id: z.string(),
  routeId: z.string(),
  hubId: z.string(),
  sequenceNo: z.number(),
  estimatedArrivalMinutes: z.number().nullable(),
})
export type RouteStopResponse = z.infer<typeof routeStopResponseSchema>
