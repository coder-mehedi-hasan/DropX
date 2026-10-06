import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { ListParams, SettlementStatus } from "@/db/models"
import { orderByClauseOf, pageOf, toDecimal, toUtcDate, whereClause } from "@/db/sql"

/**
 * A settlement as the API reads it — every `settlements` column plus the
 * customer's name and phone, which is what this surface's reader recognises.
 * Settlements are company-wide: no scope clause, the permission is the whole
 * guard, same as payments.
 */
export type SettlementRecord = {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  periodStart: string
  periodEnd: string
  totalCod: number
  deliveryCharges: number
  otherCharges: number
  netAmount: number
  status: SettlementStatus
  paidAt: string | null
  createdAt: string
}

const SETTLEMENT_COLUMNS = `
  s.id, s.customer_id, s.period_start, s.period_end, s.total_cod, s.delivery_charges,
  s.other_charges, s.net_amount, s.status, s.paid_at, s.created_at,
  c.name, c.phone
`

const SETTLEMENT_SORT_COLUMNS = {
  createdAt: "s.created_at",
  periodStart: "s.period_start",
  periodEnd: "s.period_end",
  totalCod: "s.total_cod",
  netAmount: "s.net_amount",
  status: "s.status",
} as const

const SETTLEMENT_TIEBREAK = "s.id ASC"

/** The schema stores whole days, so the wire renders the UTC date as-is. */
function toPeriodDate(value: string | Date): string {
  return toUtcDate(value).toISOString().slice(0, 10)
}

function settlementRow(row: Record<string, unknown>): SettlementRecord {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    customerName: String(row.name),
    customerPhone: String(row.phone ?? ""),
    periodStart: toPeriodDate(row.period_start as string | Date),
    periodEnd: toPeriodDate(row.period_end as string | Date),
    totalCod: toDecimal(row.total_cod),
    deliveryCharges: toDecimal(row.delivery_charges),
    otherCharges: toDecimal(row.other_charges),
    netAmount: toDecimal(row.net_amount),
    status: row.status as SettlementStatus,
    paidAt: row.paid_at === null ? null : toUtcDate(row.paid_at as string | Date).toISOString(),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
  }
}

export type ListSettlementsFilter = {
  status?: SettlementStatus | undefined
}

export async function selectSettlements(
  db: Pool,
  params: ListParams,
  filter: ListSettlementsFilter,
): Promise<{ nodes: SettlementRecord[]; totalCount: number }> {
  const clauses: string[] = []
  const filterParams: unknown[] = []

  if (filter.status) {
    clauses.push("s.status = ?")
    filterParams.push(filter.status)
  }

  const where = whereClause(clauses)
  const sortColumn = params.sortBy
    ? (SETTLEMENT_SORT_COLUMNS as Record<string, string>)[params.sortBy]
    : undefined
  const orderBy = orderByClauseOf(sortColumn, params.sort, SETTLEMENT_TIEBREAK)

  return pageOf(db, {
    pageSql: `SELECT ${SETTLEMENT_COLUMNS}
      FROM settlements AS s
      INNER JOIN customers AS c ON c.id = s.customer_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM settlements AS s${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: settlementRow,
  })
}

export async function selectSettlement(
  db: Pool | Connection,
  settlementId: string,
): Promise<SettlementRecord | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${SETTLEMENT_COLUMNS}
      FROM settlements AS s
      INNER JOIN customers AS c ON c.id = s.customer_id
     WHERE s.id = ?`,
    [settlementId],
  )
  return rows[0] ? settlementRow(rows[0]) : null
}

/**
 * The totals a settlement is built from, computed server-side: the customer's
 * paid COD and paid delivery-fee money whose collection day falls inside the
 * period (endpoint inclusive). One query, two conditional sums, so the two
 * numbers cannot disagree about which rows they counted.
 */
export type SettlementTotals = {
  totalCod: number
  deliveryCharges: number
}

export async function selectCustomerSettlementTotals(
  db: Pool | Connection,
  customerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SettlementTotals> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN p.type = 'COD' THEN p.amount END), 0) AS total_cod,
       COALESCE(SUM(CASE WHEN p.type = 'DELIVERY_FEE' THEN p.amount END), 0) AS delivery_charges
       FROM payments AS p
       INNER JOIN parcels AS par ON par.id = p.parcel_id
      WHERE par.sender_customer_id = ?
        AND p.status = 'PAID'
        AND p.paid_at >= ? AND p.paid_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [customerId, `${periodStart} 00:00:00`, periodEnd],
  )
  return {
    totalCod: toDecimal(rows[0] ? rows[0].total_cod : 0),
    deliveryCharges: toDecimal(rows[0] ? rows[0].delivery_charges : 0),
  }
}

/**
 * Locks the customer row a settlement will be raised against. The lock is the
 * second half of the one-period-per-customer guard: two clerks raising
 * settlements for the same period at the same moment each count no existing
 * row, both insert, and both win. Locking the customer serialises them.
 */
export async function lockCustomerForSettlement(
  db: Pool | Connection,
  customerId: string,
): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM customers WHERE id = ? FOR UPDATE",
    [customerId],
  )
  return rows.length > 0
}

/**
 * Whether a settlement already exists for the customer in exactly this period.
 * The table's `(customer_id, period_start, period_end)` triple is the primary
 * guard on duplicates; the customer-row lock above makes the check race-free.
 */
export async function settlementPeriodExists(
  db: Pool | Connection,
  customerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id FROM settlements
      WHERE customer_id = ? AND period_start = ? AND period_end = ?
      LIMIT 1`,
    [customerId, periodStart, periodEnd],
  )
  return rows.length > 0
}

export type InsertSettlementRecord = {
  customerId: string
  periodStart: string
  periodEnd: string
  totalCod: number
  deliveryCharges: number
  otherCharges: number
  netAmount: number
}

export async function insertSettlement(
  db: Pool | Connection,
  input: InsertSettlementRecord,
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO settlements
      (customer_id, period_start, period_end, total_cod, delivery_charges,
       other_charges, net_amount, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      input.customerId,
      input.periodStart,
      input.periodEnd,
      input.totalCod,
      input.deliveryCharges,
      input.otherCharges,
      input.netAmount,
    ],
  )
  return String(result.insertId)
}

/**
 * Status write. `paid_at` is stamped on `PAID` and cleared on any other status
 * — a retried settlement that goes FAILED can never be mistaken for paid, and
 * when it reaches PAID on the second try the stamp is the new date.
 */
export async function updateSettlementStatus(
  db: Pool | Connection,
  settlementId: string,
  status: SettlementStatus,
): Promise<number> {
  const [result] = await db.execute<OkPacket>(
    `UPDATE settlements
        SET status = ?,
            paid_at = CASE WHEN ? = 'PAID' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = ?`,
    [status, status, settlementId],
  )
  return result.affectedRows
}
