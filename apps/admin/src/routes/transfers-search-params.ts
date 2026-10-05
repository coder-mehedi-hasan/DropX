import { z } from "zod"
import { TRANSFER_STATUSES } from "@dropx/types"

const DEFAULT_TRANSFERS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
  hubId: "",
  vehicleId: "",
  driverId: "",
} as const

export const transfersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_TRANSFERS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_TRANSFERS_SEARCH.limit),
  sortBy: z.enum(["departedAt", "arrivedAt", "status", "createdAt"]).catch(
    DEFAULT_TRANSFERS_SEARCH.sortBy,
  ),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_TRANSFERS_SEARCH.sort),
  search: z.string().catch(DEFAULT_TRANSFERS_SEARCH.search),
  // `.optional()` rather than a `""` literal: clearing the filter writes
  // `undefined`, so the key is absent from the URL rather than present and empty.
  status: z.enum(TRANSFER_STATUSES).or(z.literal("")).optional(),
  hubId: z.string().catch(DEFAULT_TRANSFERS_SEARCH.hubId),
  vehicleId: z.string().catch(DEFAULT_TRANSFERS_SEARCH.vehicleId),
  driverId: z.string().catch(DEFAULT_TRANSFERS_SEARCH.driverId),
})

export type TransfersSearch = {
  page: number
  limit: number
  sortBy: "departedAt" | "arrivedAt" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof TRANSFER_STATUSES)[number] | "" | undefined
  hubId: string
  vehicleId: string
  driverId: string
}

/**
 * `hubId`, `vehicleId` and `driverId` are carried in the URL even though no
 * control on this screen sets them: all three are set from elsewhere (a hub page
 * scopes here, a vehicle row links here), and a list whose filters only live in
 * React state cannot be shared or reloaded. They are absent from the filter bar
 * rather than absent from the schema.
 */
export const DEFAULT_TRANSFERS_SEARCH_PARAMS: TransfersSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
  hubId: "",
  vehicleId: "",
  driverId: "",
}