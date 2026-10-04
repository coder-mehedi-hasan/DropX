import { z } from "zod"

import { ZONE_STATUSES } from "../../db/models"

const id = z.string().trim().min(1)
const code = z.string().trim().min(1).max(50)
const name = z.string().trim().min(1).max(100)

export const zoneIdParamSchema = z.object({ id })

export const listZonesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "code", "status", "createdAt"]).default("name"),
  sort: z.enum(["asc", "desc"]).default("asc"),
  status: z.enum(ZONE_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
})

export type ListZonesQuery = z.infer<typeof listZonesQuerySchema>

export const createZoneSchema = z.object({
  name,
  code: code.refine((value) => /^[A-Z0-9-]+$/.test(value), {
    message: "Use uppercase letters, numbers and hyphens only",
  }),
  description: z.string().trim().max(255).optional(),
  status: z.enum(ZONE_STATUSES).default("ACTIVE"),
})

export type CreateZoneInput = z.infer<typeof createZoneSchema>

export const updateZoneSchema = createZoneSchema.partial()

export type UpdateZoneInput = z.infer<typeof updateZoneSchema>

export const zoneResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  status: z.enum(ZONE_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ZoneResponse = z.infer<typeof zoneResponseSchema>
