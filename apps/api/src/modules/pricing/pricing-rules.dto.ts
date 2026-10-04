import { z } from "zod"

import { RECORD_STATUSES } from "../../db/models"

const id = z.string().trim().min(1)

/** Pricing rules are reference data with a single two-valued lifecycle. */
const priceRuleStatus = z.enum(RECORD_STATUSES).default("ACTIVE")

/** DECIMAL(10,2) → at most 2 decimals. */
const weight = z.coerce
  .number()
  .nonnegative("Enter a non-negative weight")
  .max(9999)
  .refine((value) => Number.isInteger(value * 100), { message: "Use at most 2 decimal places" })

/** DECIMAL(12,2) → at most 2 decimals, currency amount. */
const money = z.coerce
  .number()
  .nonnegative("Enter a non-negative amount")
  .max(999999)
  .refine((value) => Number.isInteger(value * 100), { message: "Use at most 2 decimal places" })

/** DECIMAL(5,2) → percentage, at most 2 decimals. */
const percent = z.coerce
  .number()
  .nonnegative("Enter a percentage between 0 and 100")
  .max(100)
  .refine((value) => Number.isInteger(value * 100), { message: "Use at most 2 decimal places" })

// --- List query --------------------------------------------------------------

export const listPricingRulesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["name", "originZone", "destinationZone", "minWeight", "createdAt"])
    .default("name"),
  sort: z.enum(["asc", "desc"]).default("asc"),
  status: priceRuleStatus.or(z.literal("")).optional(),
  search: z.string().trim().max(100).optional(),
  originZoneId: id.optional(),
  destinationZoneId: id.optional(),
})

export type ListPricingRulesQuery = z.infer<typeof listPricingRulesQuerySchema>

// --- Id params -----------------------------------------------------------------

export const pricingRuleIdParamSchema = z.object({ id })

// --- Create ------------------------------------------------------------------

export const createPricingRuleSchema = z.object({
  name: z.string().trim().min(1).max(150),
  originZoneId: id,
  destinationZoneId: id,
  minWeight: weight,
  maxWeight: weight.nullable().default(null),
  basePrice: money,
  pricePerKg: money,
  codPercentage: percent,
  codFixedFee: money,
  expressFee: money,
  status: priceRuleStatus,
})

export type CreatePricingRuleInput = z.infer<typeof createPricingRuleSchema>

/** All fields are patchable; the caller decides what to change. */
export const updatePricingRuleSchema = createPricingRuleSchema
  .omit({ status: true })
  .extend({ status: priceRuleStatus.optional() })

export type UpdatePricingRuleInput = z.infer<typeof updatePricingRuleSchema>

// --- Match query -------------------------------------------------------------

export const matchPricingRulesQuerySchema = z.object({
  originZoneId: id,
  destinationZoneId: id,
  weightKg: z.coerce.number().positive("Enter a weight").max(9999),
})

export type MatchPricingRuleQuery = z.infer<typeof matchPricingRulesQuerySchema>

// --- Response bodies ---------------------------------------------------------

export const pricingRuleResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  originZoneId: z.string(),
  destinationZoneId: z.string(),
  minWeight: z.number(),
  maxWeight: z.number().nullable(),
  basePrice: z.number(),
  pricePerKg: z.number(),
  codPercentage: z.number(),
  codFixedFee: z.number(),
  expressFee: z.number(),
  status: z.enum(RECORD_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PricingRuleResponse = z.infer<typeof pricingRuleResponseSchema>

export type PricingRuleMatch = { pricingRule: PricingRuleResponse; weightKg: number }
