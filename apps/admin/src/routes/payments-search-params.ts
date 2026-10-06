import { z } from "zod"
import { PAYMENT_STATES } from "@dropx/types"

export const DEFAULT_PAYMENTS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  status: "",
} as const

/**
 * Mirrors `listPaymentsQuerySchema` in the API: same `sortBy` allowlist, same
 * optional `status`. The list screen's status filter and sortable columns read
 * from these so the URL can only ever hold keys the API will accept.
 */
export const paymentsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_PAYMENTS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_PAYMENTS_SEARCH.limit),
  sortBy: z.enum(["createdAt", "paidAt", "amount", "status"]).catch(DEFAULT_PAYMENTS_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_PAYMENTS_SEARCH.sort),
  status: z.enum(PAYMENT_STATES).or(z.literal("")).optional(),
})

export type PaymentsSearch = {
  page: number
  limit: number
  sortBy: "createdAt" | "paidAt" | "amount" | "status"
  sort: "asc" | "desc"
  status?: (typeof PAYMENT_STATES)[number] | "" | undefined
}

export const DEFAULT_PAYMENTS_SEARCH_PARAMS: PaymentsSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  status: "",
}
