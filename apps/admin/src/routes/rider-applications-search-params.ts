import { z } from "zod"

const STATUSES = ["PENDING", "REVIEWING", "APPROVED", "REJECTED"] as const

export const DEFAULT_RIDER_APPLICATIONS_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
  status: "",
} as const

export const riderApplicationsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
  sortBy: z.enum(["name", "district", "status", "createdAt"]).catch("createdAt"),
  sort: z.enum(["asc", "desc"]).catch("desc"),
  search: z.string().catch(""),
  status: z.enum(STATUSES).or(z.literal("")).optional(),
})

export type RiderApplicationsSearch = z.infer<typeof riderApplicationsSearchSchema>
