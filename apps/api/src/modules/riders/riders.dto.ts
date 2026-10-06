import { z } from "zod"

import { COMPENSATION_TYPES, RIDER_STATUSES } from "../../db/models"

const id = z.string().trim().min(1)

export const riderIdParamSchema = z.object({ id })

export const listRidersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["employeeCode", "status", "hubId", "createdAt"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(RIDER_STATUSES).optional(),
  compensationType: z.enum(COMPENSATION_TYPES).optional(),
  hubId: id.optional(),
  search: z.string().trim().max(100).optional(),
})

export type ListRidersQuery = z.infer<typeof listRidersQuerySchema>

export const createRiderSchema = z.object({
  email: z.string().trim().email().max(150),
  name: z.string().trim().min(1).max(150),
  /** Creates the rider's login; the rider app signs in with email + password. */
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  phone: z.string().trim().max(30).nullish(),
  hubId: id,
  employeeCode: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .refine((v) => /^[A-Z0-9-]+$/.test(v), {
      message: "Use uppercase letters, numbers and hyphens only",
    }),
  licenseNumber: z.string().trim().max(100).nullish(),
  compensationType: z.enum(COMPENSATION_TYPES).default("SALARIED"),
  status: z.enum(RIDER_STATUSES).default("OFFLINE"),
})

export type CreateRiderInput = z.infer<typeof createRiderSchema>

/**
 * A rider owns exactly one `users` row (AGENTS.md rule 8), and that row is also
 * how they sign in to the rider app. The account fields are therefore not
 * patchable here — changing a rider's email or name is a user edit, not a rider
 * edit, and letting both surfaces write the same row invites a drift bug.
 */
export const updateRiderSchema = createRiderSchema
  .omit({ email: true, name: true, phone: true, password: true })
  .partial()

export type UpdateRiderInput = z.infer<typeof updateRiderSchema>

export const setRiderStatusSchema = z.object({
  status: z.enum(RIDER_STATUSES),
})

export type SetRiderStatusInput = z.infer<typeof setRiderStatusSchema>

export const riderResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  hubId: z.string(),
  employeeCode: z.string(),
  licenseNumber: z.string().nullable(),
  compensationType: z.enum(COMPENSATION_TYPES),
  status: z.enum(RIDER_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type RiderResponse = z.infer<typeof riderResponseSchema>
