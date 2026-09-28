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
