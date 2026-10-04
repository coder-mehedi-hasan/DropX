import { z } from "zod"
import { VEHICLE_STATUSES, VEHICLE_TYPES } from "@dropx/types"

const DEFAULT_VEHICLES_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  type: "",
  status: "",
} as const

export const vehiclesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_VEHICLES_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_VEHICLES_SEARCH.limit),
  sortBy: z
    .enum(["registrationNumber", "type", "status", "capacityKg", "createdAt"])
    .catch(DEFAULT_VEHICLES_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_VEHICLES_SEARCH.sort),
  search: z.string().catch(DEFAULT_VEHICLES_SEARCH.search),
  type: z.enum(VEHICLE_TYPES).or(z.literal("")).optional(),
  status: z.enum(VEHICLE_STATUSES).or(z.literal("")).optional(),
})

export type VehiclesSearch = {
  page: number
  limit: number
  sortBy: "registrationNumber" | "type" | "status" | "capacityKg" | "createdAt"
  sort: "asc" | "desc"
  search: string
  type?: (typeof VEHICLE_TYPES)[number] | "" | undefined
  status?: (typeof VEHICLE_STATUSES)[number] | "" | undefined
}

export const DEFAULT_VEHICLES_SEARCH_PARAMS: VehiclesSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  type: "",
  status: "",
}
