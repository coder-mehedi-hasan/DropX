import { z } from "zod"
import { CUSTOMER_STATUSES } from "@dropx/types"

export const DEFAULT_CUSTOMERS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
} as const

/**
 * Mirrors `listCustomersQuerySchema` in the API: same `sortBy` allowlist, same
 * optional `status`. The list screen's status filter and sortable columns read
 * from these so the URL can only ever hold keys the API will accept.
 */
export const customersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_CUSTOMERS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_CUSTOMERS_SEARCH.limit),
  sortBy: z.enum(["name", "phone", "status", "createdAt"]).catch(DEFAULT_CUSTOMERS_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_CUSTOMERS_SEARCH.sort),
  search: z.string().catch(DEFAULT_CUSTOMERS_SEARCH.search),
  status: z.enum(CUSTOMER_STATUSES).or(z.literal("")).optional(),
})

export type CustomersSearch = {
  page: number
  limit: number
  sortBy: "name" | "phone" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof CUSTOMER_STATUSES)[number] | "" | undefined
}

export const DEFAULT_CUSTOMERS_SEARCH_PARAMS: CustomersSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
}
