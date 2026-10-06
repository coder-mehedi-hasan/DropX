import { z } from "zod"

import { DELIVERY_STATUSES } from "../../db/models"

const id = z.string().trim().min(1)

/**
 * Two shapes on purpose, for the reason `docs/handoff.md` §3.3 records: an
 * absent filter stays absent, while create may invent a value — and only for
 * create.
 */
const recordStatus = z.enum(DELIVERY_STATUSES)

export const listDeliveriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["assignedAt", "deliveredAt", "status", "createdAt"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: recordStatus.optional(),
  riderId: id.optional(),
  hubId: id.optional(),
  search: z.string().trim().max(100).optional(),
})
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>

export const deliveryIdParamSchema = z.object({ id })

/**
 * Opening an attempt is assigning a rider: `rider_id` is `NOT NULL` on the row
 * and there is no rider-less "draft" attempt, so `POST /deliveries` takes the
 * rider up front and is gated on `deliveries.assign`. There is deliberately no
 * `status` field — a new attempt is always `ASSIGNED`.
 *
 * `parcelId` accepts either the row id or the tracking number, the same
 * convention as a pickup: the tracking number is the only string a human has.
 * `hubId` is not accepted — the hub is derived from the parcel, one definition
 * of "where is this parcel" rather than two.
 */
export const createDeliverySchema = z.object({
  parcelId: id,
  riderId: id,
  deliveryAddress: z.string().trim().min(1).max(500),
})
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>

/**
 * Reassigning swaps the rider without touching the parcel or the attempt
 * number: the same attempt, a different rider. Only allowed while the attempt
 * is still `ASSIGNED` — once it is out for delivery, the move is a status
 * change, not an edit.
 */
export const reassignDeliverySchema = z.object({
  riderId: id,
})
export type ReassignDeliveryInput = z.infer<typeof reassignDeliverySchema>

/**
 * `FAILED` and `CANCELLED` need a reason. The parcel moves in the same
 * transaction as the attempt — see the service.
 */
export const updateDeliveryStatusSchema = z.object({
  status: recordStatus,
  /** Required by the service for `FAILED` and `CANCELLED`, as on a pickup. */
  reason: z.string().trim().max(500).optional(),
})
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>

/**
 * The delivery row plus the names a dispatch screen renders. `deliveries`
 * carries ids only; the tracking number, hub name, and rider name are joined
 * in one statement so the list does not fan out into N+1 lookups.
 */
export const deliveryResponseSchema = z.object({
  id: z.string(),
  parcelId: z.string(),
  hubId: z.string(),
  riderId: z.string(),
  attemptNo: z.number(),
  deliveryAddress: z.string(),
  assignedAt: z.string().nullable(),
  outForDeliveryAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  status: z.enum(DELIVERY_STATUSES),
  failureReason: z.string().nullable(),
  recipientName: z.string().nullable(),
  recipientPhone: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  parcelTrackingNumber: z.string(),
  hubName: z.string(),
  hubCode: z.string(),
  riderName: z.string(),
  riderEmployeeCode: z.string(),
})
export type DeliveryResponse = z.infer<typeof deliveryResponseSchema>
