import { z } from "zod"

import { BRANCH_STATUSES, HUB_STATUSES, HUB_TYPES } from "@dropx/db"

/**
 * Boundary DTOs for the `org` feature.
 *
 * Branches and hubs are the two things every other admin screen scopes on, so
 * they are the first Phase 1 module. `users` and `roles` follow once these
 * exist: a staff member is created against a branch and optionally assigned
 * hubs, and `user_hubs` cannot be written before the hubs it references.
 */

const id = z.string().trim().min(1)
const code = z.string().trim().min(1).max(50)
const name = z.string().trim().min(1).max(150)

const optionalString = (max: number) => z.string().trim().max(max).optional()

/** `branch.code` is unique company-wide, so it is the natural slug for URLs. */
export const branchIdParamSchema = z.object({ id })

export const listBranchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "code", "status", "createdAt"]).default("name"),
  sort: z.enum(["asc", "desc"]).default("asc"),
  status: z.enum(BRANCH_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
})

export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>

export const createBranchSchema = z.object({
  name,
  code: code.refine((value) => /^[A-Z0-9-]+$/.test(value), {
    message: "Use uppercase letters, numbers and hyphens only",
  }),
  phone: optionalString(30),
  address: optionalString(500),
  city: optionalString(100),
  district: optionalString(100),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  status: z.enum(BRANCH_STATUSES).default("ACTIVE"),
})

export type CreateBranchInput = z.infer<typeof createBranchSchema>

export const updateBranchSchema = createBranchSchema.partial()

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>

/** `hubs.branch_id` is NOT NULL, so a hub cannot exist without a branch. */
export const hubIdParamSchema = z.object({ id })

export const listHubsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "code", "type", "status", "createdAt"]).default("name"),
  sort: z.enum(["asc", "desc"]).default("asc"),
  type: z.enum(HUB_TYPES).optional(),
  status: z.enum(HUB_STATUSES).optional(),
  branchId: id.optional(),
  search: z.string().trim().max(100).optional(),
})

export type ListHubsQuery = z.infer<typeof listHubsQuerySchema>

export const createHubSchema = z.object({
  branchId: id,
  name,
  code: code.refine((value) => /^[A-Z0-9-]+$/.test(value), {
    message: "Use uppercase letters, numbers and hyphens only",
  }),
  type: z.enum(HUB_TYPES),
  address: optionalString(500),
  district: optionalString(100),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  capacity: z.coerce.number().int().min(0).optional(),
  status: z.enum(HUB_STATUSES).default("ACTIVE"),
})

export type CreateHubInput = z.infer<typeof createHubSchema>

export const updateHubSchema = createHubSchema.partial()

export type UpdateHubInput = z.infer<typeof updateHubSchema>

// --- Response bodies -------------------------------------------------------

/**
 * A branch as the admin sees it. Deliberately excludes the coordinate pair
 * until a screen needs it: most list views do not, and a published contract
 * that omits a field cannot be quietly widened later.
 */
export const branchResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  status: z.enum(BRANCH_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type BranchResponse = z.infer<typeof branchResponseSchema>

/** A hub, with its branch carried alongside so the list does not need a join per row. */
export const hubResponseSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  branchName: z.string(),
  branchCode: z.string(),
  name: z.string(),
  code: z.string(),
  type: z.enum(HUB_TYPES),
  address: z.string().nullable(),
  district: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  capacity: z.number().nullable(),
  status: z.enum(HUB_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type HubResponse = z.infer<typeof hubResponseSchema>
