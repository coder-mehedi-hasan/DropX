/**
 * Wire types for the admin.
 *
 * `Parcel`, `ParcelItem` and the status/type unions are re-exported from
 * `@dropx/types` rather than restated, so the admin cannot drift from
 * the API's domain model. The remaining types describe envelopes the API adds
 * around those entities: the `{ nodes, meta }` list contract, the tracking
 * projection, and the staff identity from `/auth/me`.
 */
import { z } from "zod"
import {
  BRANCH_STATUSES,
  COMPENSATION_TYPES,
  HUB_STATUSES,
  HUB_TYPES,
  RIDER_STATUSES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
} from "@dropx/types"
import { ZONE_STATUSES, RECORD_STATUSES } from "@dropx/types"
import type {
  CustomerStatus,
  CustomerType,
  HubStatus,
  HubType,
  HubRef,
  Parcel,
  ParcelEventSummary,
  ParcelEventType,
  ParcelItem,
  ParcelStatus,
  ParcelTracking,
  ParcelType,
  ParcelWithItems,
  PricingRule,
  RecordStatus,
  Rider,
  RiderLocation,
  RiderStatus,
  CompensationType,
  Route,
  RouteStop,
  Vehicle,
  VehicleStatus,
  VehicleType,
  Zone,
} from "@dropx/types"
import type { Id, Page, PageMeta } from "@dropx/types"

export type {
  HubRef,
  Id,
  Page,
  PageMeta,
  Parcel,
  ParcelEventSummary,
  ParcelEventType,
  ParcelItem,
  ParcelStatus,
  ParcelTracking,
  ParcelType,
  ParcelWithItems,
  PricingRule,
  RecordStatus,
  Rider,
  RiderLocation,
  RiderStatus,
  CompensationType,
  Route,
  RouteStop,
  Vehicle,
  VehicleStatus,
  VehicleType,
  Zone,
}

/** Alias for the one envelope the admin adds to the shared entity types. */
export type ParcelDetail = ParcelWithItems

/** `GET /auth/me` for an `admin` audience token. */
export type StaffIdentity = {
  kind: "staff"
  audience: string
  id: Id
  email: string
  roles: string[]
  permissions: string[]
  branchId: Id | null
  hubIds: Id[]
}

/** A branch as the admin sees it. Mirrors `branchResponseSchema` in the API. */
export type Branch = {
  id: Id
  name: string
  code: string
  phone: string | null
  address: string | null
  city: string | null
  district: string | null
  latitude: number | null
  longitude: number | null
  status: "ACTIVE" | "INACTIVE"
  createdAt: string
  updatedAt: string
}

/** Narrow projection for the branch picker — name and code only. */
export type BranchOption = {
  id: Id
  name: string
  code: string
  status: "ACTIVE" | "INACTIVE"
}

/** A hub, with its branch carried alongside. Mirrors `hubResponseSchema`. */
export type Hub = {
  id: Id
  branchId: Id
  branchName: string
  branchCode: string
  name: string
  code: string
  type: "ORIGIN" | "SORTING" | "TRANSIT" | "DESTINATION"
  address: string | null
  district: string | null
  latitude: number | null
  longitude: number | null
  capacity: number | null
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE"
  createdAt: string
  updatedAt: string
}

/** Create/update bodies. The branch one is safe to derive from the list
 *  `Branch` — it carries no join fields. The hub one is written out explicitly:
 *  the list `Hub` carries `branchName`/`branchCode`, which are join fields the
 *  list endpoint adds and the create endpoint does not accept, so
 *  `Omit<Hub, ...>` would ship those two as required fields and the API would
 *  reject every create. */
export type CreateBranchBody = Omit<Branch, "id" | "createdAt" | "updatedAt">
export type UpdateBranchBody = Partial<CreateBranchBody>

export type CreateHubBody = {
  branchId: Id
  name: string
  code: string
  type: HubType
  address: string | null
  district: string | null
  latitude: number | null
  longitude: number | null
  capacity: number | null
  status: HubStatus
}
export type UpdateHubBody = Partial<CreateHubBody>

export type CreateZoneBody = Omit<Zone, "id" | "createdAt" | "updatedAt">
export type UpdateZoneBody = Partial<CreateZoneBody>

export type CreatePricingRuleBody = Omit<PricingRule, "id" | "createdAt" | "updatedAt">
export type UpdatePricingRuleBody = Partial<CreatePricingRuleBody>

export type CreateVehicleBody = Omit<Vehicle, "id" | "createdAt" | "updatedAt">
export type UpdateVehicleBody = Partial<CreateVehicleBody>

export type CreateRiderBody = {
  email: string
  name: string
  password: string
  phone?: string | null
  hubId: string
  employeeCode: string
  licenseNumber?: string | null
  compensationType: CompensationType
  status: RiderStatus
}
/** Account fields are deliberately absent — they belong to the `users` row. */
export type UpdateRiderBody = Partial<
  Omit<CreateRiderBody, "email" | "name" | "password" | "phone">
>

export type CreateRouteBody = Omit<Route, "id" | "createdAt" | "updatedAt">
export type UpdateRouteBody = Partial<CreateRouteBody>

export type RouteStopInput = {
  hubId: string
  sequenceNo: number
  estimatedArrivalMinutes?: number | null
}
export type ReplaceRouteStopsBody = { stops: RouteStopInput[] }

/**
 * Zod schemas for the create/update forms.
 *
 * These live in the client because the form's validation and the API's DTO are
 * the same contract — a field added to one is a field the other rejects. They
 * are not imported from `apps/api`; the admin is a separate package and the
 * API's DTOs are its internal boundary. Keeping a copy here means the two can
 * drift, and the only guard is that the shapes are identical by construction
 * (both derive from the same entity fields).
 */
export const createBranchSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: z.string().trim().min(1).max(50),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  status: z.enum(BRANCH_STATUSES).default("ACTIVE"),
})

export const createHubSchema = z.object({
  branchId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(150),
  code: z.string().trim().min(1).max(50),
  type: z.enum(HUB_TYPES),
  address: z.string().trim().max(500).optional(),
  district: z.string().trim().max(100).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  capacity: z.coerce.number().int().min(0).optional(),
  status: z.enum(HUB_STATUSES).default("ACTIVE"),
})

export const createZoneSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .refine((value) => /^[A-Z0-9-]+$/.test(value), {
      message: "Use uppercase letters, numbers and hyphens only",
    }),
  description: z.string().trim().max(255).nullish(),
  status: z.enum(ZONE_STATUSES).default("ACTIVE"),
})

export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(50),
  type: z.enum(VEHICLE_TYPES),
  capacityKg: z.coerce.number().min(0).max(100_000),
  status: z.enum(VEHICLE_STATUSES).default("AVAILABLE"),
})

export const createPricingRuleSchema = z.object({
  name: z.string().trim().min(1).max(150),
  originZoneId: z.string().trim().min(1),
  destinationZoneId: z.string().trim().min(1),
  minWeight: z.coerce.number().nonnegative().max(9999),
  maxWeight: z.coerce.number().nonnegative().max(9999).nullish(),
  basePrice: z.coerce.number().nonnegative().max(999999),
  pricePerKg: z.coerce.number().nonnegative().max(999999),
  codPercentage: z.coerce.number().nonnegative().max(100),
  codFixedFee: z.coerce.number().nonnegative().max(999999),
  expressFee: z.coerce.number().nonnegative().max(999999),
  status: z.enum(RECORD_STATUSES).default("ACTIVE"),
})

export const createRouteSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    code: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers and hyphens only"),
    originHubId: z.string().trim().min(1),
    destinationHubId: z.string().trim().min(1),
    distanceKm: z.coerce.number().nonnegative().max(99_999).nullish(),
    estimatedMinutes: z.coerce.number().int().nonnegative().max(99_999).nullish(),
    status: z.enum(RECORD_STATUSES).default("ACTIVE"),
  })
  .refine((v) => v.originHubId !== v.destinationHubId, {
    message: "Origin and destination hub must differ",
    path: ["destinationHubId"],
  })

export const routeStopSchema = z.object({
  hubId: z.string().trim().min(1),
  sequenceNo: z.coerce.number().int().min(1),
  estimatedArrivalMinutes: z.coerce.number().int().nonnegative().max(99_999).nullish(),
})

export const createRiderSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(150),
  name: z.string().trim().min(1, "Name is required").max(150),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  phone: z.string().trim().max(30).nullish(),
  hubId: z.string().trim().min(1, "Pick a home hub"),
  employeeCode: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers and hyphens only"),
  licenseNumber: z.string().trim().max(100).nullish(),
  compensationType: z.enum(COMPENSATION_TYPES).default("SALARIED"),
  status: z.enum(RIDER_STATUSES).default("OFFLINE"),
})

/**
 * The account half is not editable here, mirroring the API: an existing rider's
 * email and password are a user edit, and two surfaces writing one row invites a
 * drift bug. The password field is dropped, so the key is absent from the type
 * and cannot be sent by mistake.
 */
export const updateRiderSchema = createRiderSchema
  .omit({ email: true, name: true, password: true, phone: true })
  .partial()

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number }

export type LoginResult = TokenPair & {
  account: { id: Id; kind: "staff" | "rider"; name: string; email: string; roles: string[] }
}

/** The API computes the fee, so the create form only ever reads this. */
export type DeliveryQuote = {
  pricingRuleId: Id
  basePrice: number
  weightCharge: number
  codFee: number
  expressFee: number
  total: number
  currency: string
}

/*
 * Reference reads, mirroring the three `admin.reference.*` response schemas.
 *
 * Named `*Option`, not `*Ref`, on purpose. `@dropx/types` already exports a
 * `HubRef` and it is a different thing: that one is the `{ code, name, district }`
 * join embedded in a parcel detail, and it carries no `id` — a picker option has
 * to, because its whole job is to be selected and sent back as a foreign key. The
 * suffix marks a row you can choose, as against a row that decorates another one.
 */

export type HubOption = {
  id: Id
  name: string
  code: string
  type: HubType
  district: string | null
  status: HubStatus
}

export type ZoneOption = {
  id: Id
  name: string
  code: string
  status: "ACTIVE" | "INACTIVE"
}

export type CustomerOption = {
  id: Id
  name: string
  phone: string
  email: string | null
  type: CustomerType
  status: CustomerStatus
}

/** Shared by all three pickers: the API owns the ceiling, the client just sends it. */
export type ReferenceListParams = {
  page: number
  limit: number
  search?: string
  sort?: "asc" | "desc"
  sortBy?: string
}
