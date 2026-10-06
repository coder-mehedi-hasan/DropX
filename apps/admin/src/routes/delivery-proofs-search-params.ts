import { z } from "zod"
import { PROOF_TYPES } from "@dropx/types"

const DEFAULT_DELIVERY_PROOFS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  type: "",
  verified: "",
  deliveryId: "",
} as const

export const deliveryProofsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_DELIVERY_PROOFS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_DELIVERY_PROOFS_SEARCH.limit),
  sortBy: z.enum(["createdAt", "type"]).catch(DEFAULT_DELIVERY_PROOFS_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_DELIVERY_PROOFS_SEARCH.sort),
  search: z.string().catch(DEFAULT_DELIVERY_PROOFS_SEARCH.search),
  type: z.enum(PROOF_TYPES).or(z.literal("")).optional(),
  verified: z.enum(["true", "false", ""]).optional(),
  deliveryId: z.string().catch(DEFAULT_DELIVERY_PROOFS_SEARCH.deliveryId),
})

export type DeliveryProofsSearch = {
  page: number
  limit: number
  sortBy: "createdAt" | "type"
  sort: "asc" | "desc"
  search: string
  type?: (typeof PROOF_TYPES)[number] | "" | undefined
  verified?: "true" | "false" | "" | undefined
  deliveryId: string
}

export const DEFAULT_DELIVERY_PROOFS_SEARCH_PARAMS: DeliveryProofsSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  type: "",
  verified: "",
  deliveryId: "",
}
