import { z } from "zod"

import { PAYMENT_KINDS, PAYMENT_METHODS, PAYMENT_STATES } from "../../db/models"

const id = z.string().trim().min(1)

/**
 * Money on the wire is a JSON number, matching how `parcels.codAmount` and
 * `deliveryFee` travel. The refine mirrors the parcels money helper so the two
 * endpoints cannot disagree about what "money" is; the amount here is strictly
 * positive (a refund cannot be a zero row).
 */
const paymentAmount = z.coerce
  .number()
  .positive()
  .max(1_000_000)
  .refine((value) => Number.isInteger(value * 100), {
    message: "Use at most 2 decimal places",
  })

export const paymentIdParamSchema = z.object({ id })

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "paidAt", "amount", "status"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(PAYMENT_STATES).optional(),
})

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>

/**
 * `record` accepts nothing but the parcel and the amount. The method is CASH by
 * definition — this is the finance clerk's remittance of a cash COD collection —
 * and the row is written straight to `PAID`, because nothing in this flow ever
 * creates a `PENDING` row. Digital methods and a PENDING lifecycle are the
 * online-payments P2 track.
 */
export const recordPaymentSchema = z.object({
  parcelId: id,
  amount: paymentAmount,
})

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

export const refundPaymentSchema = z.object({
  amount: paymentAmount,
})

export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>

/**
 * The staff projection. The base `Payment` entity carries no tracking number —
 * the parcel id is all of it, and that is lost on a money screen. This surface
 * joins `parcels` so the rows a finance clerk actually recognises keep their
 * identity. `amount` travels as a number for the same reason parcel money does.
 */
export const paymentResponseSchema = z.object({
  id: z.string(),
  parcelId: z.string(),
  trackingNumber: z.string(),
  type: z.enum(PAYMENT_KINDS),
  amount: z.number(),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATES),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
})

export type PaymentResponse = z.infer<typeof paymentResponseSchema>
