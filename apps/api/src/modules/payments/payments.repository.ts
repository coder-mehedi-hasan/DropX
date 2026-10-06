import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { ListParams, PaymentKind, PaymentMethod, PaymentState } from "@/db/models"
import { orderByClauseOf, pageOf, toDecimal, toUtcDate, whereClause } from "@/db/sql"

/**
 * A payment as the API reads it — every `payments` column plus the parcel's
 * tracking number, which is what this surface's reader recognises. Payments are
 * company-wide: no scope clause, the permission is the whole guard.
 */
export type PaymentRecord = {
  id: string
  parcelId: string
  trackingNumber: string
  type: PaymentKind
  amount: number
  method: PaymentMethod
  status: PaymentState
  paidAt: string | null
  createdAt: string
}

const PAYMENT_COLUMNS = `
  p.id, p.parcel_id, p.type, p.amount, p.method, p.status, p.paid_at, p.created_at,
  par.tracking_number
`

const PAYMENT_SORT_COLUMNS = {
  createdAt: "p.created_at",
  paidAt: "p.paid_at",
  amount: "p.amount",
  status: "p.status",
} as const

const PAYMENT_TIEBREAK = "p.id ASC"

function paymentRow(row: Record<string, unknown>): PaymentRecord {
  return {
    id: String(row.id),
    parcelId: String(row.parcel_id),
    trackingNumber: String(row.tracking_number),
    type: row.type as PaymentKind,
    amount: toDecimal(row.amount),
    method: row.method as PaymentMethod,
    status: row.status as PaymentState,
    paidAt: row.paid_at === null ? null : toUtcDate(row.paid_at as string | Date).toISOString(),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
  }
}

export type ListPaymentsFilter = {
  status?: PaymentState | undefined
}

export async function selectPayments(
  db: Pool,
  params: ListParams,
  filter: ListPaymentsFilter,
): Promise<{ nodes: PaymentRecord[]; totalCount: number }> {
  const clauses: string[] = []
  const filterParams: unknown[] = []

  if (filter.status) {
    clauses.push("p.status = ?")
    filterParams.push(filter.status)
  }

  const where = whereClause(clauses)
  const sortColumn = params.sortBy
    ? (PAYMENT_SORT_COLUMNS as Record<string, string>)[params.sortBy]
    : undefined
  const orderBy = orderByClauseOf(sortColumn, params.sort, PAYMENT_TIEBREAK)

  return pageOf(db, {
    pageSql: `SELECT ${PAYMENT_COLUMNS}
      FROM payments AS p
      INNER JOIN parcels AS par ON par.id = p.parcel_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM payments AS p${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: paymentRow,
  })
}

export async function selectPayment(
  db: Pool | Connection,
  paymentId: string,
): Promise<PaymentRecord | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${PAYMENT_COLUMNS}
      FROM payments AS p
      INNER JOIN parcels AS par ON par.id = p.parcel_id
      WHERE p.id = ?`,
    [paymentId],
  )
  return rows[0] ? paymentRow(rows[0]) : null
}

/**
 * The parcel facts a money write needs, read under a row lock inside the
 * transaction so two concurrent remittances refunds against the same parcel
 * cannot both pass the balance check.
 */
export type ParcelPaymentFacts = {
  paymentType: string
  codAmount: number
}

export async function selectParcelPaymentFacts(
  db: Pool | Connection,
  parcelId: string,
  forUpdate: boolean,
): Promise<ParcelPaymentFacts | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT payment_type, cod_amount
       FROM parcels
      WHERE id = ?${forUpdate ? " FOR UPDATE" : ""}`,
    [parcelId],
  )
  if (!rows[0]) return null
  return {
    paymentType: String(rows[0].payment_type),
    codAmount: toDecimal(rows[0].cod_amount),
  }
}

/**
 * How much money of one kind stands paid against a parcel. Used as the two
 * halves of the refundable balance: collected COD minus already-refunded COD.
 */
export async function sumTypedPaid(
  db: Pool | Connection,
  parcelId: string,
  type: PaymentKind,
): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payments
      WHERE parcel_id = ? AND type = ? AND status = 'PAID'`,
    [parcelId, type],
  )
  return toDecimal(rows[0] ? rows[0].total : 0)
}

export type InsertPaymentInput = {
  parcelId: string
  type: PaymentKind
  amount: number
  method: PaymentMethod
}

export async function insertPayment(
  db: Pool | Connection,
  input: InsertPaymentInput,
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO payments (parcel_id, type, amount, method, status, paid_at)
     VALUES (?, ?, ?, ?, 'PAID', CURRENT_TIMESTAMP)`,
    [input.parcelId, input.type, input.amount, input.method],
  )
  return String(result.insertId)
}

/**
 * Stamps every open COD row for a parcel REFUNDED once its balance is cleared.
 * A schema without an `original_payment_id` link has no finer-grained way to say
 * "this one is returned", so the parcel-level balance is the source of truth.
 */
export async function flipCodToRefunded(db: Pool | Connection, parcelId: string): Promise<number> {
  const [result] = await db.execute<OkPacket>(
    `UPDATE payments
        SET status = 'REFUNDED'
      WHERE parcel_id = ? AND type = 'COD' AND status = 'PAID'`,
    [parcelId],
  )
  return result.affectedRows
}
