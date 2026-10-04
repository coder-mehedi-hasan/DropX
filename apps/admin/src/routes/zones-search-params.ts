import { z } from "zod"
import { ZONE_STATUSES } from "@dropx/db"

const DEFAULT_ZONES_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
} as const

export const zonesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_ZONES_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_ZONES_SEARCH.limit),
  sortBy: z.enum(["name", "code", "status", "createdAt"]).catch(DEFAULT_ZONES_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_ZONES_SEARCH.sort),
  search: z.string().catch(DEFAULT_ZONES_SEARCH.search),
  status: z.enum(ZONE_STATUSES).or(z.literal("")).optional(),
})

export type ZonesSearch = {
  page: number
  limit: number
  sortBy: "name" | "code" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof ZONE_STATUSES)[number] | "" | undefined
}

export const DEFAULT_ZONES_SEARCH_PARAMS: ZonesSearch = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
}
