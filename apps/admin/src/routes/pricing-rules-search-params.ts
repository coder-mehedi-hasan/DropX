import { z } from "zod"
import { RECORD_STATUSES } from "@dropx/types"

const DEFAULT_PRICING_RULES_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
} as const

export const pricingRulesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_PRICING_RULES_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_PRICING_RULES_SEARCH.limit),
  sortBy: z
    .enum(["name", "originZone", "destinationZone", "minWeight", "createdAt"])
    .catch(DEFAULT_PRICING_RULES_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_PRICING_RULES_SEARCH.sort),
  search: z.string().catch(DEFAULT_PRICING_RULES_SEARCH.search),
  status: z.enum(RECORD_STATUSES).or(z.literal("")).optional(),
})

export type PricingRulesSearch = {
  page: number
  limit: number
  sortBy: "name" | "originZone" | "destinationZone" | "minWeight" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof RECORD_STATUSES)[number] | "" | undefined
}

export const DEFAULT_PRICING_RULES_SEARCH_PARAMS: PricingRulesSearch = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
}
