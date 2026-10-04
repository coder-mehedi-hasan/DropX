import { z } from "zod"

import { VEHICLE_STATUSES, VEHICLE_TYPES } from "../../db/models"

const id = z.string().trim().min(1)

export const vehicleIdParamSchema = z.object({ id })

export const listVehiclesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["registrationNumber", "type", "status", "capacityKg", "createdAt"])
    .default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  type: z.enum(VEHICLE_TYPES).optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
})

export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>

export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(50),
  type: z.enum(VEHICLE_TYPES),
  capacityKg: z.coerce.number().min(0).max(100_000),
  status: z.enum(VEHICLE_STATUSES).default("AVAILABLE"),
})

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>

export const updateVehicleSchema = createVehicleSchema.partial()

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>

export const vehicleResponseSchema = z.object({
  id: z.string(),
  registrationNumber: z.string(),
  type: z.enum(VEHICLE_TYPES),
  capacityKg: z.number(),
  status: z.enum(VEHICLE_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type VehicleResponse = z.infer<typeof vehicleResponseSchema>
