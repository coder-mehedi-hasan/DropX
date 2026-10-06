import { z } from "zod"
import { RECORD_STATUSES } from "@dropx/types"

const DEFAULT_PRICING_LANES_SEARCH = {
  page: 1,
  limit: 50,
  sortBy: "pickupType",
  sort: "asc",
  status: "",
} as const

export const pricingLanesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_PRICING_LANES_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_PRICING_LANES_SEARCH.limit),
  sortBy: z
    .enum(["pickupType", "deliveryType", "status", "createdAt"])
    .catch(DEFAULT_PRICING_LANES_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_PRICING_LANES_SEARCH.sort),
  status: z.enum(RECORD_STATUSES).or(z.literal("")).optional(),
})

export type PricingLanesSearch = {
  page: number
  limit: number
  sortBy: "pickupType" | "deliveryType" | "status" | "createdAt"
  sort: "asc" | "desc"
  status?: (typeof RECORD_STATUSES)[number] | "" | undefined
}

export const DEFAULT_PRICING_LANES_SEARCH_PARAMS: PricingLanesSearch = {
  page: 1,
  limit: 50,
  sortBy: "pickupType",
  sort: "asc",
  status: "",
}
