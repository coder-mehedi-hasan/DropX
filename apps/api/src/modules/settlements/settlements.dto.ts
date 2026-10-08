import { z } from "zod"

import { SETTLEMENT_STATUSES } from "../../db/models"

const id = z.string().trim().min(1)

/**
 * A calendar period as `YYYY-MM-DD`, endpoint inclusive. The table stores DATEs,
 * so a settlement is a whole-day statement: "everything paid COD on 1 Jan–31 Jan".
 */
const date = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")

export const settlementIdParamSchema = z.object({ id })

export const listSettlementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "periodStart", "periodEnd", "totalCod", "netAmount", "status"])
    .default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(SETTLEMENT_STATUSES).optional(),
})

export type ListSettlementsQuery = z.infer<typeof listSettlementsQuerySchema>

/**
 * `create` accepts nothing but the customer and the period. Every money column
 * is computed server-side from the customer's paid `payments` rows inside that
 * period — a client-typed total is the settlement lying, the same rule as
 * pricing (architecture rule 11). Refunds (REFUND rows) already cancelled
 * themselves out of the COD balance before this point, so COD collected is the
 * number the books will pay out.
 */
export const createSettlementSchema = z
  .object({
    customerId: id,
    periodStart: date,
    periodEnd: date,
  })
  .refine((value) => value.periodEnd >= value.periodStart, {
    message: "The period cannot end before it starts",
    path: ["periodEnd"],
  })

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>

export const setSettlementStatusSchema = z.object({
  status: z.enum(SETTLEMENT_STATUSES),
})

export type SetSettlementStatusInput = z.infer<typeof setSettlementStatusSchema>

/**
 * The staff projection for a money screen: a finance clerk recognises a
 * merchant by name and phone, not by a customer id, so the customer identity
 * rides along with every row.
 */
export const settlementResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  totalCod: z.number(),
  deliveryCharges: z.number(),
  otherCharges: z.number(),
  netAmount: z.number(),
  status: z.enum(SETTLEMENT_STATUSES),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
})

export type SettlementResponse = z.infer<typeof settlementResponseSchema>
