import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { CustomerStatus, CustomerType, ListParams } from "@/db/models"
import { escapeLike, orderByClauseOf, pageOf, toUtcDate, whereClause } from "@/db/sql"

/**
 * A customer as the API reads it — every `customers` column, straight off the
 * table. Staff rows are scoped through `user_hubs`/branch; customers are
 * company-wide, so there is no scope clause and the permission is all the
 * guard there is.
 */
export type CustomerRecord = {
  id: string
  name: string
  phone: string
  email: string | null
  type: CustomerType
  status: CustomerStatus
  consentAcceptedAt: string | null
  activatedAt: string | null
  createdAt: string
  updatedAt: string
}

const CUSTOMER_COLUMNS = `
  c.id, c.name, c.phone, c.email, c.type, c.status, c.consent_accepted_at,
  c.activated_at, c.created_at, c.updated_at
`

/**
 * Client sort key → SQL column expression (the `rider-locations` shape, not an
 * allowlist compare — see the comment in `users.repository`).
 */
const CUSTOMER_SORT_COLUMNS = {
  name: "c.name",
  phone: "c.phone",
  status: "c.status",
  createdAt: "c.created_at",
} as const

const CUSTOMER_TIEBREAK = "c.id ASC"
const CUSTOMER_SEARCH_COLUMNS = ["c.name", "c.phone", "c.email"]

function customerRow(row: Record<string, unknown>): CustomerRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: String(row.phone),
    email: row.email === null ? null : String(row.email),
    type: row.type as CustomerType,
    status: row.status as CustomerStatus,
    consentAcceptedAt:
      row.consent_accepted_at === null
        ? null
        : toUtcDate(row.consent_accepted_at as string | Date).toISOString(),
    activatedAt:
      row.activated_at === null ? null : toUtcDate(row.activated_at as string | Date).toISOString(),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

export type ListCustomersFilter = {
  status?: CustomerStatus | undefined
  search?: string | undefined
}

export async function selectCustomers(
  db: Pool,
  params: ListParams,
  filter: ListCustomersFilter,
): Promise<{ nodes: CustomerRecord[]; totalCount: number }> {
  const clauses: string[] = []
  const filterParams: unknown[] = []

  if (filter.status) {
    clauses.push("c.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${CUSTOMER_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of CUSTOMER_SEARCH_COLUMNS) filterParams.push(like)
  }

  const where = whereClause(clauses)
  const sortColumn = params.sortBy
    ? (CUSTOMER_SORT_COLUMNS as Record<string, string>)[params.sortBy]
    : undefined
  const orderBy = orderByClauseOf(sortColumn, params.sort, CUSTOMER_TIEBREAK)

  return pageOf(db, {
    pageSql: `SELECT ${CUSTOMER_COLUMNS} FROM customers AS c ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM customers AS c${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: customerRow,
  })
}

export async function selectCustomer(
  db: Pool | Connection,
  customerId: string,
): Promise<CustomerRecord | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers AS c WHERE c.id = ?`,
    [customerId],
  )
  return rows[0] ? customerRow(rows[0]) : null
}

/**
 * The whole address book for one customer, newest first. No N+1: `read` calls
 * this once and `list` never needs it (the list row is a support summary, not
 * an address book).
 */
export async function selectCustomerAddresses(
  db: Pool | Connection,
  customerId: string,
): Promise<AddressRecord[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, customer_id, label, address_line, city, district, postal_code, latitude, longitude,
            is_default, created_at, updated_at
       FROM customer_addresses
      WHERE customer_id = ?
      ORDER BY is_default DESC, id ASC`,
    [customerId],
  )
  return rows.map(addressRow)
}

export type AddressRecord = {
  id: string
  customerId: string
  label: string | null
  addressLine: string
  city: string | null
  district: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

function addressRow(row: Record<string, unknown>): AddressRecord {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    label: row.label === null ? null : String(row.label),
    addressLine: String(row.address_line),
    city: row.city === null ? null : String(row.city),
    district: row.district === null ? null : String(row.district),
    postalCode: row.postal_code === null ? null : String(row.postal_code),
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    isDefault: Boolean(row.is_default),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

/**
 * The override. Same statement the OTP path uses (`auth.repository
 * .activateCustomer`) so whichever route flips the flag, the row reads the
 * same. `WHERE c.status = 'TEMP'` makes the write itself idempotent, so a
 * retried POST cannot clobber an `activated_at` set by an earlier one.
 */
export async function activateCustomerRow(
  db: Pool | Connection,
  customerId: string,
): Promise<boolean> {
  const [result] = await db.execute<OkPacket>(
    `UPDATE customers
        SET status = 'ACTIVE', activated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'TEMP'`,
    [customerId],
  )
  return result.affectedRows > 0
}
