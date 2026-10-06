import { z } from "zod"
import { PICKUP_STATUSES } from "@dropx/types"

const DEFAULT_PICKUPS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
  riderId: "",
  hubId: "",
} as const

export const pickupsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_PICKUPS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_PICKUPS_SEARCH.limit),
  sortBy: z.enum(["scheduledAt", "status", "createdAt"]).catch(DEFAULT_PICKUPS_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_PICKUPS_SEARCH.sort),
  search: z.string().catch(DEFAULT_PICKUPS_SEARCH.search),
  // `.optional()` rather than a `""` literal: clearing the filter writes
  // `undefined`, so the key is absent from the URL rather than present and empty.
  status: z.enum(PICKUP_STATUSES).or(z.literal("")).optional(),
  riderId: z.string().catch(DEFAULT_PICKUPS_SEARCH.riderId),
  hubId: z.string().catch(DEFAULT_PICKUPS_SEARCH.hubId),
})

export type PickupsSearch = {
  page: number
  limit: number
  sortBy: "scheduledAt" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof PICKUP_STATUSES)[number] | "" | undefined
  riderId: string
  hubId: string
}

/**
 * `riderId` and `hubId` are carried in the URL even though no control on this
 * screen sets them: both are set from elsewhere (a rider row links here, a hub
 * page scopes here), and a list whose filters only live in React state cannot be
 * shared or reloaded. They are absent from the filter bar rather than absent
 * from the schema.
 */
export const DEFAULT_PICKUPS_SEARCH_PARAMS: PickupsSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
  riderId: "",
  hubId: "",
}
