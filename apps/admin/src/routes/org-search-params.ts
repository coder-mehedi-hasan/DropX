import { z } from "zod"
import { BRANCH_STATUSES, HUB_STATUSES, HUB_TYPES } from "@dropx/db/entities"

/**
 * List state for the org screens lives in the URL, same as parcels.
 *
 * Branches and hubs are company-wide reads, so there is no scope field to
 * carry — the only filter is the caller's own permission to see the screen.
 * `""` is a real option on the enum filters so a `<Select>` can express "no
 * filter"; the page coerces and `.catch`-guards everything so a hand-edited
 * link degrades to defaults instead of throwing.
 */
export const DEFAULT_ORG_SEARCH = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
  type: "",
  branchId: "",
} as const

export const branchesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_ORG_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_ORG_SEARCH.limit),
  sortBy: z.enum(["name", "code", "status", "createdAt"]).catch(DEFAULT_ORG_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_ORG_SEARCH.sort),
  search: z.string().catch(DEFAULT_ORG_SEARCH.search),
  status: z.enum(BRANCH_STATUSES).or(z.literal("")).optional(),
})

export const hubsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_ORG_SEARCH.page),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_ORG_SEARCH.limit),
  sortBy: z.enum(["name", "code", "type", "status", "createdAt"]).catch(DEFAULT_ORG_SEARCH.sortBy),
  sort: z.enum(["asc", "desc"]).catch(DEFAULT_ORG_SEARCH.sort),
  search: z.string().catch(DEFAULT_ORG_SEARCH.search),
  type: z.enum(HUB_TYPES).or(z.literal("")).optional(),
  status: z.enum(HUB_STATUSES).or(z.literal("")).optional(),
  branchId: z.string().optional(),
})

/**
 * The shape the endpoint functions actually take. Deliberately not
 * `z.infer<...>` — the schema's optional fields carry `| undefined`, but the
 * endpoint functions build the query object and the API client drops
 * `undefined`/`""` before sending, so the runtime type is the union without
 * `undefined`. Declaring it here keeps the two honest.
 */
export type BranchesSearch = {
  page: number
  limit: number
  sortBy: "name" | "code" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  status?: (typeof BRANCH_STATUSES)[number] | "" | undefined
}

export type HubsSearch = {
  page: number
  limit: number
  sortBy: "name" | "code" | "type" | "status" | "createdAt"
  sort: "asc" | "desc"
  search: string
  type?: (typeof HUB_TYPES)[number] | "" | undefined
  status?: (typeof HUB_STATUSES)[number] | "" | undefined
  branchId?: string | undefined
}

/** Defaults for the nav links, kept next to the schemas so they cannot drift. */
export const DEFAULT_BRANCHES_SEARCH: BranchesSearch = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  status: "",
}

export const DEFAULT_HUBS_SEARCH: HubsSearch = {
  page: 1,
  limit: 20,
  sortBy: "name",
  sort: "asc",
  search: "",
  type: "",
  status: "",
}
