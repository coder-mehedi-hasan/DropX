import { z } from "zod"

import { PICKUP_STATUSES } from "../../db/models"

const id = z.string().trim().min(1)

/**
 * Two shapes on purpose, for the reason `docs/handoff.md` §3.3 records.
 * `recordStatus` has no `.default()`, so an absent field stays absent — used by
 * the list filter and by every update, where defaulting would silently rewrite a
 * record the caller never mentioned. `createStatus` may invent a value, and only
 * for create.
 */
const recordStatus = z.enum(PICKUP_STATUSES)
const createStatus = recordStatus.default("REQUESTED")

export const listPickupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["scheduledAt", "status", "createdAt"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: recordStatus.optional(),
  riderId: id.optional(),
  hubId: id.optional(),
  search: z.string().trim().max(100).optional(),
})
export type ListPickupsQuery = z.infer<typeof listPickupsQuerySchema>

export const pickupIdParamSchema = z.object({ id })

/**
 * Staff raise a collection for a parcel. `requestedBy` is never in the body — it
 * is the authenticated actor, so the audit column cannot be pointed at someone
 * else.
 *
 * `parcelId` accepts either the row id or the tracking number; see
 * `lockScopedParcelForUpdate` for why a field only a human could know is the one
 * worth taking here.
 */
export const createPickupSchema = z.object({
  parcelId: id,
  pickupAddress: z.string().trim().min(1).max(500),
  scheduledAt: z.iso.datetime().nullish(),
  status: createStatus,
})
export type CreatePickupInput = z.infer<typeof createPickupSchema>

/**
 * Assignment is its own operation, gated on `pickups.assign` rather than
 * `pickups.manage`: dispatch assigning a rider is a separate authority from
 * editing a pickup's details, and ops needs to hand that out on its own.
 *
 * `riderId` is required rather than nullable because unassigning is a status
 * change, not an assignment — clearing the rider is done by moving the pickup
 * back to `REQUESTED`, which is a transition the service validates.
 */
export const assignPickupSchema = z.object({
  riderId: id,
  scheduledAt: z.iso.datetime().nullish(),
})
export type AssignPickupInput = z.infer<typeof assignPickupSchema>

/**
 * `PICKED_UP` is the only status that stamps `picked_up_at`, and it is also the
 * only one that advances the parcel — that coupling lives in the service, in one
 * transaction, rather than in a client that would have to remember to do both.
 */
export const updatePickupStatusSchema = z.object({
  status: recordStatus,
  /** Required by the service for `FAILED` and `CANCELLED`, as on a delivery. */
  reason: z.string().trim().max(500).optional(),
})
export type UpdatePickupStatusInput = z.infer<typeof updatePickupStatusSchema>

export const pickupResponseSchema = z.object({
  id: z.string(),
  parcelId: z.string(),
  requestedBy: z.string().nullable(),
  assignedRiderId: z.string().nullable(),
  pickupAddress: z.string(),
  scheduledAt: z.string().nullable(),
  pickedUpAt: z.string().nullable(),
  status: z.enum(PICKUP_STATUSES),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type PickupResponse = z.infer<typeof pickupResponseSchema>
