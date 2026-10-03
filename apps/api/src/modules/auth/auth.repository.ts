import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"

/**
 * Persistence for `auth`.
 *
 * Identity reads only — no password comparison and no business rules here.
 * Those belong to `auth.service.ts`.
 */

export type StaffLoginRow = {
  id: string
  email: string
  name: string
  password_hash: string
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
}

export type CustomerByIdentifierRow = {
  id: string
  name: string
  phone: string
  email: string | null
  status: "TEMP" | "ACTIVE"
}

const CUSTOMER_COLUMNS = "id, name, phone, email, status"

export const authRepository = {
  async findUserByEmail(db: Pool, email: string): Promise<StaffLoginRow | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, email, name, password_hash, status
         FROM users
        WHERE email = ?
        LIMIT 1`,
      [email],
    )
    return rows[0] as StaffLoginRow | null
  },

  /** Riders authenticate as users; the rider profile is resolved separately. */
  async findRiderByUserId(db: Pool, userId: string): Promise<{ id: string; hub_id: string } | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, hub_id FROM riders WHERE user_id = ? LIMIT 1`,
      [userId],
    )
    return rows[0] as { id: string; hub_id: string } | null
  },

  /** One lookup across both unique columns — phone and email are both unique. */
  async findCustomerByIdentifier(
    db: Pool,
    identifier: string,
  ): Promise<CustomerByIdentifierRow | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, name, phone, email, status
         FROM customers
        WHERE phone = ? OR email = ?
        LIMIT 1`,
      [identifier, identifier],
    )
    return rows[0] as CustomerByIdentifierRow | null
  },

  async createTempCustomer(
    db: Pool,
    input: { name: string; phone: string; email: string | null },
  ): Promise<CustomerByIdentifierRow> {
    const [result] = await db.execute<OkPacket>(
      `INSERT INTO customers (name, phone, email, type, status, consent_accepted_at)
       VALUES (?, ?, ?, 'INDIVIDUAL', 'TEMP', CURRENT_TIMESTAMP)`,
      [input.name, input.phone, input.email],
    )

    const id = result.insertId
    if (!id) throw new Error("Customer insert returned no id")

    return {
      id: String(id),
      name: input.name,
      phone: input.phone,
      email: input.email,
      status: "TEMP",
    }
  },

  async activateCustomer(
    db: Pool,
    customerId: string,
  ): Promise<{ id: string; name: string; phone: string; email: string | null; status: "ACTIVE" }> {
    await db.execute<OkPacket>(
      `UPDATE customers
          SET status = 'ACTIVE', activated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [customerId],
    )

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ? LIMIT 1`,
      [customerId],
    )
    const row = rows[0] as CustomerByIdentifierRow

    if (!row) throw new Error("Customer disappeared between update and read")

    return { ...row, status: "ACTIVE" }
  },

  async upsertCustomerName(db: Pool, customerId: string, name: string): Promise<void> {
    await db.execute<OkPacket>(`UPDATE customers SET name = ? WHERE id = ?`, [name, customerId])
  },

  async touchLastLogin(db: Pool, userId: string): Promise<void> {
    // `updated_at` is ON UPDATE CURRENT_TIMESTAMP, so this records the activity.
    await db.execute<OkPacket>(`UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [userId])
  },

  async findCustomerById(
    db: Pool,
    customerId: string,
  ): Promise<{ id: string; name: string; phone: string; email: string | null } | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ? LIMIT 1`,
      [customerId],
    )
    if (!rows[0]) return null
    const row = rows[0] as CustomerByIdentifierRow
    return { id: String(row.id), name: row.name, phone: row.phone, email: row.email }
  },
}

export type AuthRepository = typeof authRepository
