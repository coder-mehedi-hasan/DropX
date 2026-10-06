import type { Context } from "hono"

import { DomainError, ERROR_CODES, notFound } from "../../core"
import { buildPage, normalizeListParams, type Page } from "../../db/models"
import { canTransitionSettlement } from "../../db/models"
import { toDecimal } from "../../db/sql"
import { withTransaction } from "../../db/transaction"
import { emit } from "../../shared/events/bus"
import type { AppEnv } from "../../types/env"

import type {
  CreateSettlementInput,
  ListSettlementsQuery,
  SetSettlementStatusInput,
  SettlementResponse,
} from "./settlements.dto"
import {
  insertSettlement,
  lockCustomerForSettlement,
  selectCustomerSettlementTotals,
  selectSettlement,
  selectSettlements,
  settlementPeriodExists,
  updateSettlementStatus,
} from "./settlements.repository"

const roundMoney = (value: number) => Math.round(value * 100) / 100

export async function listSettlements(
  c: Context<AppEnv>,
  query: ListSettlementsQuery,
): Promise<Page<SettlementResponse>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectSettlements(c.get("db")!, params, {
    status: query.status,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getSettlement(
  c: Context<AppEnv>,
  settlementId: string,
): Promise<SettlementResponse> {
  const settlement = await selectSettlement(c.get("db")!, settlementId)
  if (!settlement) throw notFound("No such settlement")
  return settlement
}

/**
 * Raises a period settlement for a customer.
 *
 * The one statement of a merchant's books for a period, so every number is
 * computed here, never accepted from a client: total COD collected and total
 * delivery fees across the customer's parcels whose payments were recorded
 * `PAID` inside `[periodStart, periodEnd]`. `net` is what the company owes the
 * merchant — COD minus delivery fees — which is the number the disbursement is
 * drawn against.
 *
 * Runs in a transaction under a `FOR UPDATE` lock on the customer row. Two
 * clerks settling the same customer and period at the same moment must not both
 * count zero existing periods and both win — the lock serialises them, the
 * period triplicate check refuses the second one.
 *
 * A period that collected nothing is refused (`422 VALIDATION_FAILED`): issuing
 * a zero statement is an accounting no-op, and accepting one teaches clients to
 * pass totals in. Refunded COD already cancelled itself out of the balance at
 * refund time, so a fully refunded period is exactly this case.
 */
export async function createSettlement(
  c: Context<AppEnv>,
  input: CreateSettlementInput,
): Promise<SettlementResponse> {
  const db = c.get("db")!

  const { settlementId, totalCod, deliveryCharges, netAmount } = await withTransaction(
    db,
    async (tx) => {
      if (!(await lockCustomerForSettlement(tx, input.customerId))) {
        throw notFound("No such customer")
      }
      if (await settlementPeriodExists(tx, input.customerId, input.periodStart, input.periodEnd)) {
        throw new DomainError(
          ERROR_CODES.ALREADY_EXISTS,
          "A settlement already exists for this customer and period",
          {
            details: [
              {
                field: "period",
                message: "Pick dates that do not overlap an existing settlement",
              },
            ],
          },
        )
      }

      const totals = await selectCustomerSettlementTotals(
        tx,
        input.customerId,
        input.periodStart,
        input.periodEnd,
      )
      const otherCharges = 0
      const netAmount = roundMoney(totals.totalCod - totals.deliveryCharges)
      if (!(totals.totalCod || totals.deliveryCharges)) {
        throw new DomainError(
          ERROR_CODES.VALIDATION_FAILED,
          "Nothing was collected for this customer in this period",
          {
            details: [
              {
                field: "period",
                message: "Extend the period, or pick a customer with collected COD",
              },
            ],
          },
        )
      }

      const inserted = await insertSettlement(tx, {
        customerId: input.customerId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalCod: toDecimal(totals.totalCod),
        deliveryCharges: toDecimal(totals.deliveryCharges),
        otherCharges,
        netAmount,
      })
      return {
        settlementId: inserted,
        totalCod: totals.totalCod,
        deliveryCharges: totals.deliveryCharges,
        netAmount,
      }
    },
  )

  emit("settlement.created", {
    settlementId,
    customerId: input.customerId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalCod,
    deliveryCharges,
    netAmount,
  })

  const created = await selectSettlement(db, settlementId)
  /* c8 ignore next -- the row was written by the statement above. */
  if (!created) throw new Error("Settlement disappeared right after insert")
  return created
}

/**
 * Drives the settlement through `PENDING → PROCESSING → PAID`, with `FAILED`
 * and `FAILED → PENDING` for a bounced payout retry. `PAID` is terminal: a
 * settled period is never reopened — a correction is a new period's
 * settlement. A `paid_at` stamp is written exactly when the disbursement moves
 * to `PAID`.
 */
export async function setSettlementStatus(
  c: Context<AppEnv>,
  settlementId: string,
  input: SetSettlementStatusInput,
): Promise<SettlementResponse> {
  const db = c.get("db")!

  const { from, customerId } = await withTransaction(db, async (tx) => {
    const settlement = await selectSettlement(tx, settlementId)
    if (!settlement) throw notFound("No such settlement")
    if (!canTransitionSettlement(settlement.status, input.status)) {
      throw new DomainError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        `A ${settlement.status} settlement cannot become ${input.status}`,
      )
    }
    await updateSettlementStatus(tx, settlementId, input.status)
    return { from: settlement.status, customerId: settlement.customerId }
  })

  emit("settlement.status_changed", {
    settlementId,
    customerId,
    from,
    to: input.status,
  })

  const updated = await selectSettlement(db, settlementId)
  /* c8 ignore next -- the row was written by the statement above. */
  if (!updated) throw new Error("Settlement disappeared right after update")
  return updated
}
