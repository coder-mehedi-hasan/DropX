import type { Context } from "hono"

import { DomainError, ERROR_CODES, notFound } from "../../core"
import { buildPage, normalizeListParams, type Page } from "../../db/models"
import { toDecimal } from "../../db/sql"
import { withTransaction } from "../../db/transaction"
import { emit } from "../../shared/events/bus"
import type { AppEnv } from "../../types/env"

import type {
  ListPaymentsQuery,
  PaymentResponse,
  RecordPaymentInput,
  RefundPaymentInput,
} from "./payments.dto"
import {
  flipCodToRefunded,
  insertPayment,
  selectPayment,
  selectParcelPaymentFacts,
  selectPayments,
  sumTypedPaid,
} from "./payments.repository"

/**
 * Money arithmetic in integer minor units. Amounts arrive with at most two
 * decimals, but JSON floats make 0.1 + 0.2 come back as 0.30000000000000004;
 * converting to cents before comparing kills that class of bug at its source.
 */
const toCents = (value: number) => Math.round(toDecimal(value) * 100)
const roundMoney = (value: number) => Math.round(value * 100) / 100

export async function listPayments(
  c: Context<AppEnv>,
  query: ListPaymentsQuery,
): Promise<Page<PaymentResponse>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectPayments(c.get("db")!, params, {
    status: query.status,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getPayment(c: Context<AppEnv>, paymentId: string): Promise<PaymentResponse> {
  const payment = await selectPayment(c.get("db")!, paymentId)
  if (!payment) throw notFound("No such payment")
  return payment
}

/**
 * The finance clerk's remittance of a cash COD collection.
 *
 * Runs in a transaction under a lock on the parcel row so two clerks settling
 * the same parcel cannot both pass the balance check. The row is written
 * straight to `PAID` with method `CASH`: nothing in this flow creates a
 * `PENDING` row, and CASH is the only method batch 4 accepts — the rest of the
 * method enum belongs to the online-payments P2 track.
 *
 * Deliberately not tied to the parcel being DELIVERED: COD can be settled once
 * money changes hands, and the delivery lifecycle already has strict enough
 * gates of its own.
 */
export async function recordPayment(
  c: Context<AppEnv>,
  input: RecordPaymentInput,
): Promise<PaymentResponse> {
  const db = c.get("db")!

  const { paymentId, amount } = await withTransaction(db, async (tx) => {
    const parcel = await selectParcelPaymentFacts(tx, input.parcelId, true)
    if (!parcel) throw notFound("No such parcel")
    if (parcel.paymentType !== "COD") {
      throw new DomainError(
        ERROR_CODES.VALIDATION_FAILED,
        "Only a COD parcel can have a remittance recorded",
        {
          details: [{ field: "parcelId", message: "Pick a parcel that collects on delivery" }],
        },
      )
    }

    const amount = roundMoney(input.amount)
    const remainingCents =
      toCents(parcel.codAmount) - toCents(await sumTypedPaid(tx, input.parcelId, "COD"))
    if (toCents(amount) > remainingCents) {
      throw new DomainError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        `The remittance exceeds the ${roundMoney(remainingCents / 100)} still outstanding on this parcel`,
        {
          details: [
            {
              field: "amount",
              message: `Enter at most ${roundMoney(remainingCents / 100)}`,
            },
          ],
        },
      )
    }

    const inserted = await insertPayment(tx, {
      parcelId: input.parcelId,
      type: "COD",
      amount,
      method: "CASH",
    })
    return { paymentId: inserted, amount }
  })

  emit("payment.recorded", { paymentId, parcelId: input.parcelId, amount })

  const created = await selectPayment(db, paymentId)
  /* c8 ignore next -- the row was written by the statement above. */
  if (!created) throw new Error("Payment disappeared right after insert")
  return created
}

/**
 * Refunds a paid COD collection against the parcel's balance.
 *
 * The anchor is a *payment*, not a parcel: a finance clerk refunds the row they
 * can see, and the row's parcel provides the balance. Balance = COD collected
 * minus already-refunded; a refund that would push it negative is refused. When
 * the balance reaches exactly zero the parcel's remaining open COD rows are
 * stamped REFUNDED — the schema has no original-payment link, so the
 * parcel-level balance is the only faithful picture of "used to be collected".
 */
export async function refundPayment(
  c: Context<AppEnv>,
  paymentId: string,
  input: RefundPaymentInput,
): Promise<PaymentResponse> {
  const db = c.get("db")!

  const { refundId, parcelId, amount } = await withTransaction(db, async (tx) => {
    const original = await selectPayment(tx, paymentId)
    if (!original) throw notFound("No such payment")
    if (original.type !== "COD" || original.status !== "PAID") {
      throw new DomainError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        "Only a paid COD collection can be refunded",
      )
    }

    const parcel = await selectParcelPaymentFacts(tx, original.parcelId, true)
    if (!parcel) throw notFound("No such parcel")

    const amount = roundMoney(input.amount)
    const balanceCents =
      toCents(await sumTypedPaid(tx, original.parcelId, "COD")) -
      toCents(await sumTypedPaid(tx, original.parcelId, "REFUND"))
    if (toCents(amount) > balanceCents) {
      throw new DomainError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        `The refund exceeds the ${roundMoney(balanceCents / 100)} left to refund on this parcel`,
        {
          details: [
            {
              field: "amount",
              message: `Enter at most ${roundMoney(balanceCents / 100)}`,
            },
          ],
        },
      )
    }

    const inserted = await insertPayment(tx, {
      parcelId: original.parcelId,
      type: "REFUND",
      amount,
      method: "CASH",
    })
    if (balanceCents - toCents(amount) <= 0) {
      await flipCodToRefunded(tx, original.parcelId)
    }
    return { refundId: inserted, parcelId: original.parcelId, amount }
  })

  emit("payment.refunded", { paymentId: refundId, parcelId, amount })

  const refund = await selectPayment(db, refundId)
  /* c8 ignore next -- the row was written by the statement above. */
  if (!refund) throw new Error("Refund disappeared right after insert")
  return refund
}
