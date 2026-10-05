import { z } from "zod"

export const DEFAULT_RIDER_LOCATIONS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "recordedAt",
  sort: "desc",
  riderId: "",
} as const

/**
 * The only filter is the rider, because the trail is a plain append-only log:
 * there is no status, no text, and nothing else to narrow it by. `sortBy` has one
 * member for the same reason — a table with a single meaningful ordering should
 * not advertise that a client may choose it.
 */
export const riderLocationsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_RIDER_LOCATIONS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_RIDER_LOCATIONS_SEARCH.limit),
  sortBy: z.enum(["recordedAt"]).catch(DEFAULT_RIDER_LOCATIONS_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_RIDER_LOCATIONS_SEARCH.sort),
  riderId: z.string().catch(DEFAULT_RIDER_LOCATIONS_SEARCH.riderId),
})

export type RiderLocationsSearch = {
  page: number
  limit: number
  sortBy: "recordedAt"
  sort: "asc" | "desc"
  riderId: string
}

export const DEFAULT_RIDER_LOCATIONS_SEARCH_PARAMS: RiderLocationsSearch = {
  page: 1,
  limit: 20,
  sortBy: "recordedAt",
  sort: "desc",
  riderId: "",
}
