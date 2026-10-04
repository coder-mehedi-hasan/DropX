import type { RowDataPacket } from "mysql2/promise"

import type { Context } from "hono"
import type { AppEnv } from "../../types/env"

import { ERROR_CODES, DomainError } from "../../core"

type Id = string

/**
 * DECIMAL(12,2) string columns — coerce to number once, here, and nowhere else.
 */
function toDecimal(value: string | null | undefined, fallback = 0): number {
  return value == null ? fallback : Number(value)
}

/**
 * Delivery fee quoting.
 *
 * The rule is anchored on **destination zone** (see `docs/overview.md`):
 * pick the active rule whose origin zone, destination zone and weight band all
 * match, then fee = base + perKg × weight, plus COD and express adders.
 *
 * This is its own module because `pricing_rules` is a domain that other
 * features (admin pricing screens, settlements) also need.
 */

type PricingRuleRow = RowDataPacket & {
  min_weight: string
  max_weight: string | null
  base_price: string
  price_per_kg: string
  cod_percentage: string
  cod_fixed_fee: string
  express_fee: string
}

export type QuoteInput = {
  originZoneId: Id
  destinationZoneId: Id
  weightKg: number
  codAmount: number
  express?: boolean
}

export type Quote = {
  pricingRuleId: Id
  basePrice: number
  weightCharge: number
  codFee: number
  expressFee: number
  total: number
  currency: "BDT"
}

export async function quoteDeliveryFee(c: Context<AppEnv>, input: QuoteInput): Promise<Quote> {
  const rule = await findMatchingRule(c, input)

  if (!rule) {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      "No delivery price is configured for that route and weight",
      { details: [{ field: "weight", message: "Choose a weight covered by a pricing rule" }] },
    )
  }

  const basePrice = toDecimal(rule.base_price)
  const pricePerKg = toDecimal(rule.price_per_kg)
  const weightCharge = round2(pricePerKg * input.weightKg)

  // COD carries a percentage of the collected amount plus a fixed handling fee.
  const codFee =
    input.codAmount > 0
      ? round2(
          (toDecimal(rule.cod_percentage) / 100) * input.codAmount + toDecimal(rule.cod_fixed_fee),
        )
      : 0

  const expressFee = input.express ? toDecimal(rule.express_fee) : 0

  return {
    pricingRuleId: rule.id,
    basePrice,
    weightCharge,
    codFee,
    expressFee,
    total: round2(basePrice + weightCharge + codFee + expressFee),
    currency: "BDT",
  }
}

export async function findMatchingRule(
  c: Context<AppEnv>,
  input: QuoteInput,
): Promise<PricingRuleRow | null> {
  const [rows] = await c.get("db")!.query<PricingRuleRow[]>(
    `SELECT id, min_weight, max_weight, base_price, price_per_kg,
             cod_percentage, cod_fixed_fee, express_fee
        FROM pricing_rules
       WHERE status = 'ACTIVE'
         AND origin_zone_id = ?
         AND destination_zone_id = ?
         AND min_weight <= ?
         AND (max_weight IS NULL OR max_weight >= ?)
       ORDER BY min_weight DESC
       LIMIT 1`,
    [input.originZoneId, input.destinationZoneId, input.weightKg, input.weightKg],
  )
  return rows[0] ?? null
}

/** DECIMAL(12,2) columns — round once, here, and nowhere else. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}
