import { z } from "zod"

export const DEFAULT_ROLES_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
} as const

export const rolesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_ROLES_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_ROLES_SEARCH.limit),
  sortBy: z.enum(["name", "createdAt"]).catch(DEFAULT_ROLES_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_ROLES_SEARCH.sort),
  search: z.string().catch(DEFAULT_ROLES_SEARCH.search),
})

export type RolesSearch = {
  page: number
  limit: number
  sortBy: "name" | "createdAt"
  sort: "asc" | "desc"
  search: string
}

export const DEFAULT_ROLES_SEARCH_PARAMS: RolesSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
}
