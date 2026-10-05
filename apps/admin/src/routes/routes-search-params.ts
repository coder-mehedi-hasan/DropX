import { z } from "zod"
import { RECORD_STATUSES } from "@dropx/types"

const DEFAULT_ROUTES_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
} as const

export const routesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_ROUTES_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_ROUTES_SEARCH.limit),
  sortBy: z.enum(["name", "code", "status", "createdAt"]).catch(DEFAULT_ROUTES_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_ROUTES_SEARCH.sort),
  search: z.string().catch(DEFAULT_ROUTES_SEARCH.search),
  status: z.enum(RECORD_STATUSES).or(z.literal("")).optional(),
})

export type RoutesSearch = {
  page: number
  limit: number
  sortBy: "name" | "code" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof RECORD_STATUSES)[number] | "" | undefined
}

export const DEFAULT_ROUTES_SEARCH_PARAMS: RoutesSearch = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
}
