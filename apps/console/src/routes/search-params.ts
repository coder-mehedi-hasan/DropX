import { z } from "zod"
import { PARCEL_STATUSES, PAYMENT_TYPES } from "@dropx/db/entities"

import { DEFAULT_PARCELS_SEARCH, PARCEL_SORT_COLUMNS } from "@/lib/parcels"
import type { ParcelListSearch } from "@/lib/parcels"

export { DEFAULT_PARCELS_SEARCH, paymentFilter, statusFilter } from "@/lib/parcels"

/**
 * List state lives in the URL.
 *
 * Every field is coerced and `.catch`-guarded so a hand-edited or stale link
 * degrades to `DEFAULT_PARCELS_SEARCH` instead of throwing a route error — a
 * shared parcel URL is a normal way to open the console. The `""` members of the
 * filter unions exist purely so a `<Select>` can express "no filter"; read them
 * through `statusFilter` / `paymentFilter` to get the narrowed type.
 */
export const parcelsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_PARCELS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_PARCELS_SEARCH.limit),
  sortBy: z.enum(PARCEL_SORT_COLUMNS).catch(DEFAULT_PARCELS_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_PARCELS_SEARCH.sort),
  search: z.string().catch(DEFAULT_PARCELS_SEARCH.search),
  status: z.enum(PARCEL_STATUSES).or(z.literal("")).optional(),
  paymentType: z.enum(PAYMENT_TYPES).or(z.literal("")).optional(),
  hubId: z.string().optional(),
})

export type ParcelsSearch = ParcelListSearch

export const loginSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const trackingSearchSchema = z.object({
  tracking: z.string().max(50).optional(),
})
