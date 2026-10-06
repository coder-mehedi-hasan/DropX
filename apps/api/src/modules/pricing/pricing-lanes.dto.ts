import { z } from "zod"

import {
  PRICING_DELIVERY_TYPES,
  PRICING_PICKUP_TYPES,
  RECORD_STATUSES,
} from "../../db/models"

/**
 * Boundary DTOs for the lane matrix.
 *
 * A lane is a fixed row of the matrix — pickup type, delivery type, same-city —
 * so there is deliberately **no create-lane operation**: the twelve rows are
 * product configuration, seeded, not something a screen invents. What staff
 * edit is a lane's status, the slabs under it, and the COD figures on them.
 *
 * Weight is **grams** everywhere here. The bands are 0-200g, 201-500g,
 * 501g-1kg and 1kg-2kg; a kilogram column cannot express the first two, and a
 * `minWeightGrams: 0, maxWeightGrams: 0.2` pair would need a decimal guard on
 * top of a range guard.
 */

const id = z.string().trim().min(1)

const decimalPlacesError = "Use at most 2 decimal places"

const money = z.coerce
  .number()
  .min(0)
  .max(1_000_000)
  .refine((value) => Number.isInteger(value * 100), { message: decimalPlacesError })

const percent = z.coerce
  .number()
  .min(0)
  .max(100)
  .refine((value) => Number.isInteger(value * 100), { message: decimalPlacesError })

const grams = z.coerce.number().int().min(0).max(1_000_000)

// --- List -------------------------------------------------------------------

export const listPricingLanesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["pickupType", "deliveryType", "status", "createdAt"]).default("pickupType"),
  sort: z.enum(["asc", "desc"]).default("asc"),
  status: z.enum(RECORD_STATUSES).optional(),
})

export type ListPricingLanesQuery = z.infer<typeof listPricingLanesQuerySchema>

// --- Params -----------------------------------------------------------------

export const pricingLaneIdParamSchema = z.object({ id })
export const pricingLanePathParamSchema = z.object({ laneId: id })
export const pricingSlabIdParamSchema = z.object({ id })

// --- Bodies -----------------------------------------------------------------

export const updatePricingLaneSchema = z.object({
  status: z.enum(RECORD_STATUSES),
})

export type UpdatePricingLaneInput = z.infer<typeof updatePricingLaneSchema>

const slabFields = {
  minWeightGrams: grams,
  maxWeightGrams: grams,
  baseFee: money,
  extraKgFee: money,
  codPercentage: percent,
  codFixedFee: money,
  status: z.enum(RECORD_STATUSES).default("ACTIVE"),
}

/**
 * The whole slab on create. `maxWeightGrams > minWeightGrams` is checked here
 * as well as by the database's CHECK, so a bad band is a field-level 422 rather
 * than a driver error. Overlap with an existing slab of the same lane cannot be
 * expressed in a single-row schema — it is a comparison against other rows —
 * and lives in the service.
 */
export const createPricingSlabSchema = z
  .object(slabFields)
  .refine((value) => value.maxWeightGrams > value.minWeightGrams, {
    message: "The upper bound must be above the lower bound",
    path: ["maxWeightGrams"],
  })

export type CreatePricingSlabInput = z.infer<typeof createPricingSlabSchema>

/** Status-only edits of the numbers themselves are the `PATCH /slabs/:id` body. */
export const updatePricingSlabSchema = z
  .object({
    minWeightGrams: grams.optional(),
    maxWeightGrams: grams.optional(),
    baseFee: money.optional(),
    extraKgFee: money.optional(),
    codPercentage: percent.optional(),
    codFixedFee: money.optional(),
    status: z.enum(RECORD_STATUSES).optional(),
  })
  .refine(
    (value) =>
      value.minWeightGrams === undefined ||
      value.maxWeightGrams === undefined ||
      value.maxWeightGrams > value.minWeightGrams,
    {
      message: "The upper bound must be above the lower bound",
      path: ["maxWeightGrams"],
    },
  )

export type UpdatePricingSlabInput = z.infer<typeof updatePricingSlabSchema>

/**
 * COD settings as one operation rather than a PATCH per slab: the COD percentage
 * and handling fee are a company-wide rule in every lane of this matrix, and a
 * screen that asked an operator to repeat the same two numbers forty-eight times
 * would get forty-eight slightly different answers.
 */
export const updateCodSettingsSchema = z.object({
  codPercentage: percent,
  codFixedFee: money,
})

export type UpdateCodSettingsInput = z.infer<typeof updateCodSettingsSchema>

// --- Responses --------------------------------------------------------------

export const pricingSlabResponseSchema = z.object({
  id: z.string(),
  pricingLaneId: z.string(),
  minWeightGrams: z.number(),
  maxWeightGrams: z.number(),
  baseFee: z.number(),
  extraKgFee: z.number(),
  codPercentage: z.number(),
  codFixedFee: z.number(),
  status: z.enum(RECORD_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const pricingLaneResponseSchema = z.object({
  id: z.string(),
  pickupType: z.enum(PRICING_PICKUP_TYPES),
  deliveryType: z.enum(PRICING_DELIVERY_TYPES),
  sameCity: z.boolean(),
  status: z.enum(RECORD_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

/** One matrix row: the lane, ordered by weight, with its slabs attached. */
export const pricingLaneWithSlabsResponseSchema = pricingLaneResponseSchema.extend({
  slabs: z.array(pricingSlabResponseSchema),
})

export const codSettingsResponseSchema = z.object({
  codPercentage: z.number(),
  codFixedFee: z.number(),
  /** How many slabs the change was written to — the screen's confirmation. */
  slabsUpdated: z.number(),
})
