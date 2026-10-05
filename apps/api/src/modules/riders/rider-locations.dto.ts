import { z } from "zod"

const id = z.string().trim().min(1)

/**
 * Location history is append-only and read newest-first, so there is nothing to
 * filter but the rider. `sortBy` has exactly one member: the table has one
 * meaningful ordering, and offering more would let a client ask for a sort the
 * repository silently ignores.
 */
export const listRiderLocationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["recordedAt"]).default("recordedAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  riderId: id.optional(),
})

export type ListRiderLocationsQuery = z.infer<typeof listRiderLocationsQuerySchema>

/**
 * Who a fix belongs to is the token's business, not the body's, so `riderId` is
 * deliberately absent: a rider who could name another rider would be writing into
 * someone else's trail. The service adds it from the authenticated actor.
 */
export const reportLocationSchema = z.object({
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  /** The device's clock, accepted because a phone with a wrong clock is common. */
  recordedAt: z.iso.datetime().optional(),
})

/** What the push body carries. */
export type ReportLocationInput = z.infer<typeof reportLocationSchema>

export const riderLocationResponseSchema = z.object({
  id: z.string(),
  riderId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  recordedAt: z.string(),
})

export type RiderLocationResponse = z.infer<typeof riderLocationResponseSchema>
