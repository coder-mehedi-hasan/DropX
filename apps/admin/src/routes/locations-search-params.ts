import { z } from "zod"
import { LOCATION_SERVICE_TYPES, RECORD_STATUSES } from "@dropx/types"

const DEFAULT_CITIES_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
  serviceType: "",
} as const

const DEFAULT_SERVICE_ZONES_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
  cityId: "",
} as const

const DEFAULT_SERVICE_AREAS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
  zoneId: "",
} as const

export const citiesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_CITIES_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_CITIES_SEARCH.limit),
  sortBy: z
    .enum(["name", "code", "serviceType", "status", "createdAt"])
    .catch(DEFAULT_CITIES_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_CITIES_SEARCH.sort),
  search: z.string().catch(DEFAULT_CITIES_SEARCH.search),
  status: z.enum(RECORD_STATUSES).or(z.literal("")).optional(),
  serviceType: z.enum(LOCATION_SERVICE_TYPES).or(z.literal("")).optional(),
})

export type ServiceCitiesSearch = {
  page: number
  limit: number
  sortBy: "name" | "code" | "serviceType" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof RECORD_STATUSES)[number] | "" | undefined
  serviceType?: (typeof LOCATION_SERVICE_TYPES)[number] | "" | undefined
}

export const DEFAULT_CITIES_SEARCH_PARAMS: ServiceCitiesSearch = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
  serviceType: "",
}

export const serviceZonesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_SERVICE_ZONES_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_SERVICE_ZONES_SEARCH.limit),
  sortBy: z
    .enum(["name", "code", "status", "createdAt"])
    .catch(DEFAULT_SERVICE_ZONES_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_SERVICE_ZONES_SEARCH.sort),
  search: z.string().catch(DEFAULT_SERVICE_ZONES_SEARCH.search),
  status: z.enum(RECORD_STATUSES).or(z.literal("")).optional(),
  cityId: z.string().optional(),
})

export type ServiceZonesSearch = {
  page: number
  limit: number
  sortBy: "name" | "code" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof RECORD_STATUSES)[number] | "" | undefined
  cityId?: string | undefined
}

export const DEFAULT_SERVICE_ZONES_SEARCH_PARAMS: ServiceZonesSearch = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
  cityId: "",
}

export const serviceAreasSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_SERVICE_AREAS_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_SERVICE_AREAS_SEARCH.limit),
  sortBy: z
    .enum(["name", "code", "status", "createdAt"])
    .catch(DEFAULT_SERVICE_AREAS_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_SERVICE_AREAS_SEARCH.sort),
  search: z.string().catch(DEFAULT_SERVICE_AREAS_SEARCH.search),
  status: z.enum(RECORD_STATUSES).or(z.literal("")).optional(),
  cityId: z.string().optional(),
  zoneId: z.string().optional(),
})

export type ServiceAreasSearch = {
  page: number
  limit: number
  sortBy: "name" | "code" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof RECORD_STATUSES)[number] | "" | undefined
  cityId?: string | undefined
  zoneId?: string | undefined
}

export const DEFAULT_SERVICE_AREAS_SEARCH_PARAMS: ServiceAreasSearch = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
  cityId: "",
  zoneId: "",
}
