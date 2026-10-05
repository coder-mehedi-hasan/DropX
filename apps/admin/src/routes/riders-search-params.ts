import { z } from "zod"
import { COMPENSATION_TYPES, RIDER_STATUSES } from "@dropx/types"

export const DEFAULT_RIDERS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
  compensationType: "",
  hubId: "",
} as const

export const ridersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_RIDERS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_RIDERS_SEARCH.limit),
  sortBy: z
    .enum(["employeeCode", "status", "hubId", "createdAt"])
    .catch(DEFAULT_RIDERS_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_RIDERS_SEARCH.sort),
  search: z.string().catch(DEFAULT_RIDERS_SEARCH.search),
  status: z.enum(RIDER_STATUSES).or(z.literal("")).optional(),
  compensationType: z.enum(COMPENSATION_TYPES).or(z.literal("")).optional(),
  hubId: z.string().optional(),
})

export type RidersSearch = {
  page: number
  limit: number
  sortBy: "employeeCode" | "status" | "hubId" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof RIDER_STATUSES)[number] | "" | undefined
  compensationType?: (typeof COMPENSATION_TYPES)[number] | "" | undefined
  hubId?: string | undefined
}

export const DEFAULT_RIDERS_SEARCH_PARAMS: RidersSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
  compensationType: "",
  hubId: "",
}
