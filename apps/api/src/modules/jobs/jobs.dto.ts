import { z } from "zod"

import { DELIVERY_STATUSES, PARCEL_STATUSES, PAYMENT_TYPES, PICKUP_STATUSES } from "../../db/models"

/**
 * Boundary DTOs for the rider app.
 *
 * A rider never sends or receives a permission key, a hub id, or a parcel
 * status the dispatch side owns. The only decisions available on the road are
 * the delivery outcome, so that is the only thing the DTO accepts.
 */

const id = z.string().trim().min(1)

export const listJobsQuerySchema = z.object({
  /** Omit for every attempt the rider holds, across all statuses. */
  status: z.enum(DELIVERY_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(100).optional(),
})

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>

export const listPickupJobsQuerySchema = z.object({
  status: z.enum(PICKUP_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type ListPickupJobsQuery = z.infer<typeof listPickupJobsQuerySchema>

export const updatePickupJobStatusSchema = z
  .object({
    status: z.enum(["IN_PROGRESS", "PICKED_UP", "FAILED"]),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "FAILED" && !value.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Tell us why the pickup could not be completed",
      })
    }
  })

export type UpdatePickupJobStatusInput = z.infer<typeof updatePickupJobStatusSchema>

export const jobIdParamSchema = z.object({ id })

/**
 * The outcome a rider reports.
 *
 * `FAILED` and `RETURNED` both require a reason — the support and finance teams
 * act on it, so an empty string is rejected at the boundary rather than stored.
 */
export const updateJobStatusSchema = z
  .object({
    status: z.enum(["OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED"]),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    const needsReason = value.status === "FAILED" || value.status === "RETURNED"
    if (needsReason && !value.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Tell us why the delivery could not be completed",
      })
    }
  })

export type UpdateJobStatusInput = z.infer<typeof updateJobStatusSchema>

// --- Response bodies -------------------------------------------------------

/**
 * One end of the parcel a job moves. Nullable: a parcel booked before the
 * structured-address migration has no `parcel_addresses` row, and the flat
 * `delivery.address` snapshot is the only address there is.
 */
export const jobAddressResponseSchema = z.object({
  addressLine: z.string().nullable(),
  areaName: z.string().nullable(),
  zoneName: z.string().nullable(),
  cityName: z.string().nullable(),
  landmark: z.string().nullable(),
})

export const jobResponseSchema = z.object({
  delivery: z.object({
    id: z.string(),
    attemptNo: z.number(),
    status: z.enum(DELIVERY_STATUSES),
    address: z.string(),
    addressLine: z.string().nullable(),
    areaName: z.string().nullable(),
    zoneName: z.string().nullable(),
    cityName: z.string().nullable(),
    landmark: z.string().nullable(),
    failureReason: z.string().nullable(),
    recipientName: z.string().nullable(),
    recipientPhone: z.string().nullable(),
    outForDeliveryAt: z.iso.datetime().nullable(),
    deliveredAt: z.iso.datetime().nullable(),
  }),
  pickup: jobAddressResponseSchema,
  parcel: z.object({
    id: z.string(),
    trackingNumber: z.string(),
    status: z.enum(PARCEL_STATUSES),
    weight: z.number(),
    codAmount: z.number(),
    paymentType: z.enum(PAYMENT_TYPES),
    createdAt: z.iso.datetime(),
  }),
})

export const jobItemResponseSchema = z.object({
  id: z.string(),
  parcelId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  createdAt: z.iso.datetime(),
})

export const jobDetailResponseSchema = jobResponseSchema.extend({
  items: z.array(jobItemResponseSchema),
})

export const pickupJobResponseSchema = z.object({
  pickup: z.object({
    id: z.string(),
    status: z.enum(PICKUP_STATUSES),
    address: z.string(),
    scheduledAt: z.iso.datetime().nullable(),
    pickedUpAt: z.iso.datetime().nullable(),
    failureReason: z.string().nullable(),
  }),
  parcel: z.object({
    id: z.string(),
    trackingNumber: z.string(),
    status: z.enum(PARCEL_STATUSES),
    weight: z.number(),
    codAmount: z.number(),
    paymentType: z.enum(PAYMENT_TYPES),
    createdAt: z.iso.datetime(),
  }),
})
