import { z } from "zod"
import { DELIVERY_STATUSES } from "@dropx/types"

const DEFAULT_DELIVERIES_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
  riderId: "",
  hubId: "",
} as const

export const deliveriesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_DELIVERIES_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_DELIVERIES_SEARCH.limit),
  sortBy: z
    .enum(["assignedAt", "deliveredAt", "status", "createdAt"])
    .catch(DEFAULT_DELIVERIES_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_DELIVERIES_SEARCH.sort),
  search: z.string().catch(DEFAULT_DELIVERIES_SEARCH.search),
  // `.optional()` rather than a `""` literal: clearing the filter writes
  // `undefined`, so the key is absent from the URL rather than present and empty.
  status: z.enum(DELIVERY_STATUSES).or(z.literal("")).optional(),
  riderId: z.string().catch(DEFAULT_DELIVERIES_SEARCH.riderId),
  hubId: z.string().catch(DEFAULT_DELIVERIES_SEARCH.hubId),
})

export type DeliveriesSearch = {
  page: number
  limit: number
  sortBy: "assignedAt" | "deliveredAt" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof DELIVERY_STATUSES)[number] | "" | undefined
  riderId: string
  hubId: string
}

/**
 * `riderId` and `hubId` are carried in the URL even though no control on this
 * screen sets them: both are set from elsewhere (a rider row links here, a hub
 * page scopes here), and a list whose filters only live in React state cannot be
 * shared or reloaded.
 */
export const DEFAULT_DELIVERIES_SEARCH_PARAMS: DeliveriesSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
  riderId: "",
  hubId: "",
}
