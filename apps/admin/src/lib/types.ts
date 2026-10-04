/**
 * Wire types for the admin.
 *
 * `Parcel`, `ParcelItem` and the status/type unions are re-exported from
 * `@dropx/db` rather than restated, so the admin cannot drift from
 * the API's domain model. The remaining types describe envelopes the API adds
 * around those entities: the `{ nodes, meta }` list contract, the tracking
 * projection, and the staff identity from `/auth/me`.
 */
import { z } from "zod"
import { BRANCH_STATUSES, HUB_STATUSES, HUB_TYPES, VEHICLE_STATUSES, VEHICLE_TYPES } from "@dropx/db"
import { ZONE_STATUSES } from "@dropx/db"
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
  Vehicle,
  VehicleStatus,
  VehicleType,
  Zone,
} from "@dropx/db"
import type { Id, Page, PageMeta } from "@dropx/db"

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

export type CreateVehicleBody = Omit<Vehicle, "id" | "createdAt" | "updatedAt">
export type UpdateVehicleBody = Partial<CreateVehicleBody>

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
  description: z.string().trim().max(255).optional(),
  status: z.enum(ZONE_STATUSES).default("ACTIVE"),
})

export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(50),
  type: z.enum(VEHICLE_TYPES),
  capacityKg: z.coerce.number().min(0).max(100_000),
  status: z.enum(VEHICLE_STATUSES).default("AVAILABLE"),
})

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
 * Named `*Option`, not `*Ref`, on purpose. `@dropx/db` already exports a
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
