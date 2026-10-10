import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import { toUtcDate } from "@/db/sql"
import type { CustomerType } from "@/db/models"

/**
 * The profile row — a single `customers` projection, scoped by the session's
 * own id. Staff reads go through the `customers` module; this is the customer
 * looking at themselves, so the shape deliberately matches the portal.
 */

export type CustomerProfileRecord = {
  id: string
  code: string
  name: string
  phone: string
  email: string | null
  type: CustomerType
  avatarUrl: string | null
  createdAt: string
}

const PROFILE_COLUMNS = `id, code, name, phone, email, type, avatar_url, created_at`

function profileRow(row: Record<string, unknown>): CustomerProfileRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    phone: String(row.phone),
    email: row.email === null ? null : String(row.email),
    type: row.type as CustomerType,
    avatarUrl: row.avatar_url === null ? null : String(row.avatar_url),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
  }
}

export async function selectCustomerProfile(
  db: Pool,
  customerId: string,
): Promise<CustomerProfileRecord | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${PROFILE_COLUMNS} FROM customers WHERE id = ?`,
    [customerId],
  )
  return rows[0] ? profileRow(rows[0]) : null
}

export async function updateCustomerProfile(
  db: Pool,
  customerId: string,
  input: { name?: string; avatarUrl?: string | null },
): Promise<CustomerProfileRecord | null> {
  const sets: string[] = []
  const params: (string | null)[] = []

  if (input.name !== undefined) {
    sets.push("name = ?")
    params.push(input.name)
  }
  if (input.avatarUrl !== undefined) {
    sets.push("avatar_url = ?")
    params.push(input.avatarUrl)
  }

  if (sets.length === 0) return selectCustomerProfile(db, customerId)

  params.push(customerId)
  await db.execute<OkPacket>(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`, params)

  return selectCustomerProfile(db, customerId)
}