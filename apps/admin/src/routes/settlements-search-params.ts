import { z } from "zod"
import { SETTLEMENT_STATUSES } from "@dropx/types"

export const DEFAULT_SETTLEMENTS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  status: "",
} as const

/**
 * Mirrors `listSettlementsQuerySchema` in the API: same `sortBy` allowlist,
 * same optional `status`. The finance screen's status filter and sortable
 * columns read from these so the URL can only ever hold keys the API accepts.
 */
export const settlementsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_SETTLEMENTS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_SETTLEMENTS_SEARCH.limit),
  sortBy: z
    .enum(["createdAt", "periodStart", "periodEnd", "totalCod", "netAmount", "status"])
    .catch(DEFAULT_SETTLEMENTS_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_SETTLEMENTS_SEARCH.sort),
  status: z.enum(SETTLEMENT_STATUSES).or(z.literal("")).optional(),
})

export type SettlementsSearch = {
  page: number
  limit: number
  sortBy: "createdAt" | "periodStart" | "periodEnd" | "totalCod" | "netAmount" | "status"
  sort: "asc" | "desc"
  status?: (typeof SETTLEMENT_STATUSES)[number] | "" | undefined
}

export const DEFAULT_SETTLEMENTS_SEARCH_PARAMS: SettlementsSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  status: "",
}
