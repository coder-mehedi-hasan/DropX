import { z } from "zod"
import { USER_STATUSES } from "@dropx/types"

export const DEFAULT_USERS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
  branchId: "",
} as const

export const usersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_USERS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_USERS_SEARCH.limit),
  sortBy: z.enum(["name", "email", "status", "createdAt"]).catch(DEFAULT_USERS_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_USERS_SEARCH.sort),
  search: z.string().catch(DEFAULT_USERS_SEARCH.search),
  status: z.enum(USER_STATUSES).or(z.literal("")).optional(),
  branchId: z.string().optional(),
})

export type UsersSearch = {
  page: number
  limit: number
  sortBy: "name" | "email" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof USER_STATUSES)[number] | "" | undefined
  branchId?: string | undefined
}

export const DEFAULT_USERS_SEARCH_PARAMS: UsersSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
  branchId: "",
}
