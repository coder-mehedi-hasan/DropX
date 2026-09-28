import { z } from "zod"

/** Public tracking is by tracking number only — see `docs/overview.md`. */
export const trackingNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(6, "Enter a valid tracking number")
  .max(50)
  .regex(/^[A-Z0-9-]+$/, "Enter a valid tracking number")

export const trackingLookupSchema = z.object({
  trackingNumber: trackingNumberSchema,
})

export type TrackingLookupInput = z.infer<typeof trackingLookupSchema>

// --- Response bodies -------------------------------------------------------

/** A hub reference. Hubs carry `district`, not `city` (unlike branches). */
export const hubRefResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  district: z.string().nullable(),
})

export const trackingEventResponseSchema = z.object({
  eventType: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  createdAt: z.iso.datetime(),
})

/**
 * The public tracking projection.
 *
 * Deliberately excludes sender/receiver identity — public tracking is by
 * tracking number only and must not leak unrelated PII.
 */
export const trackingResponseSchema = z.object({
  trackingNumber: z.string(),
  status: z.string(),
  parcelType: z.string(),
  paymentType: z.string(),
  codAmount: z.number(),
  weight: z.number(),
  originHub: hubRefResponseSchema,
  destinationHub: hubRefResponseSchema,
  currentHub: hubRefResponseSchema.nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  events: z.array(trackingEventResponseSchema),
})
