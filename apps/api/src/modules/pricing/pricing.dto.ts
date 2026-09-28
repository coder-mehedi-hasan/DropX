import { z } from "zod"

/**
 * Quote input.
 *
 * Zones are explicit rather than derived from a hub: `hubs` and `zones` are
 * independent tables, and the address-to-zone mapping belongs to a checkout
 * flow that can pick a default for the customer.
 */
export const quoteSchema = z.object({
  originZoneId: z.string().trim().min(1),
  destinationZoneId: z.string().trim().min(1),
  weightKg: z.coerce
    .number()
    .positive("Enter a weight")
    .max(9999)
    .refine((value) => Number.isInteger(value * 100), { message: "Use at most 2 decimal places" }),
  codAmount: z.coerce.number().min(0).max(1_000_000).default(0),
  express: z.coerce.boolean().default(false),
})

export type QuoteInputDto = z.infer<typeof quoteSchema>
