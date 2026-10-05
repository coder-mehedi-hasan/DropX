import { z } from "zod"

export const vehicleTypes = ["BICYCLE", "MOTORCYCLE", "CAR", "VAN", "OTHER"] as const
export const riderApplicationStatuses = ["PENDING", "REVIEWING", "APPROVED", "REJECTED"] as const

export const riderApplicationIdParamSchema = z.object({ id: z.string().trim().min(1) })

export const listRiderApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "district", "status", "createdAt"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(riderApplicationStatuses).optional(),
  search: z.string().trim().max(100).optional(),
})

export const updateRiderApplicationSchema = z.object({
  status: z.enum(riderApplicationStatuses),
})

export const riderApplicationSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(150),
  phone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .max(30)
    .regex(/^\+?[0-9\s-]+$/, "Enter a valid phone number"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(255)
    .optional()
    .or(z.literal("")),
  district: z.string().trim().min(2, "Enter your district").max(100),
  vehicleType: z.enum(vehicleTypes),
  licenseNumber: z.string().trim().max(100).optional().or(z.literal("")),
  experienceYears: z.coerce.number().min(0, "Experience cannot be negative").max(60).optional(),
  availability: z.string().trim().min(2, "Tell us when you are available").max(100),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  consent: z.literal(true, "You must agree to be contacted by DropX"),
})

export type RiderApplicationInput = z.infer<typeof riderApplicationSchema>

export const riderApplicationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  district: z.string(),
  vehicleType: z.enum(vehicleTypes),
  licenseNumber: z.string().nullable(),
  experienceYears: z.number().nullable(),
  availability: z.string(),
  notes: z.string().nullable(),
  status: z.enum(riderApplicationStatuses),
  createdAt: z.string(),
  updatedAt: z.string(),
})
