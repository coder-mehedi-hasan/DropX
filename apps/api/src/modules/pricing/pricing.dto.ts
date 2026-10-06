import { z } from "zod"

import { PRICING_DELIVERY_TYPES, PRICING_PICKUP_TYPES } from "../../db/models"

/**
 * Quote input.
 *
 * The client sends the two ends of the trip as **ids it already picked in the
 * booking cascade**, plus the weight in grams. It sends no price, no lane, and
 * no zone-to-zone rule id — every one of those is derived here, because the
 * number it gets back has to be the number the booking charges.
 *
 * Zones travel with the cities not because pricing uses them but because the
 * address is incomplete without them: validating the pair here is what stops a
 * zone being filed under the wrong city and then silently billed as if it were
 * in the right one.
 */
export const quoteSchema = z.object({
  pickupCityId: z.string().trim().min(1),
  pickupZoneId: z.string().trim().min(1),
  deliveryCityId: z.string().trim().min(1),
  deliveryZoneId: z.string().trim().min(1),
  weightGrams: z.coerce
    .number()
    .int("Enter a weight in grams")
    .positive("Enter a weight")
    // The parcel column tops out at 9999kg; a quote for a heavier parcel would
    // be accepted at booking and refused here, which is the wrong way round.
    .max(10_000_000),
  codAmount: z.coerce.number().min(0).max(1_000_000).default(0),
})

export type QuoteInputDto = z.infer<typeof quoteSchema>

// --- Response bodies -------------------------------------------------------

/**
 * The breakdown, and nothing the client can reinterpret.
 *
 * `baseFee` is the flat price of the slab the weight landed in; anything above
 * the top slab is `extraWeightFee` rather than a per-kilogram rate, so "৳20 per
 * extra kilogram" is a configured number instead of an arithmetic rule the
 * client might re-derive differently.
 */
export const quoteResponseSchema = z.object({
  baseFee: z.number(),
  codFee: z.number(),
  extraWeightFee: z.number(),
  total: z.number(),
  currency: z.literal("BDT"),
  lane: z.object({
    pickupType: z.enum(PRICING_PICKUP_TYPES),
    deliveryType: z.enum(PRICING_DELIVERY_TYPES),
    sameCity: z.boolean(),
  }),
  slab: z.object({
    minWeightGrams: z.number(),
    maxWeightGrams: z.number(),
  }),
})
