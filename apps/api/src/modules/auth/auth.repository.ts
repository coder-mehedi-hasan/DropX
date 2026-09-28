import { TABLES, toId, toStringOrNull, type Database, type Id } from "@dropx/db"

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

export const authRepository = {
  async findUserByEmail(db: Database, email: string): Promise<StaffLoginRow | null> {
    return db.queryOne<StaffLoginRow>(
      `SELECT id, email, name, password_hash, status
         FROM ${TABLES.users}
        WHERE email = ?
        LIMIT 1`,
      [email],
    )
  },

  /** Riders authenticate as users; the rider profile is resolved separately. */
  async findRiderByUserId(
    db: Database,
    userId: Id,
  ): Promise<{ id: string; hub_id: string } | null> {
    return db.queryOne<{ id: string; hub_id: string }>(
      `SELECT id, hub_id FROM ${TABLES.riders} WHERE user_id = ? LIMIT 1`,
      [userId],
    )
  },

  /** One lookup across both unique columns — phone and email are both unique. */
  async findCustomerByIdentifier(
    db: Database,
    identifier: string,
  ): Promise<CustomerByIdentifierRow | null> {
    return db.queryOne<CustomerByIdentifierRow>(
      `SELECT id, name, phone, email, status
         FROM ${TABLES.customers}
        WHERE phone = ? OR email = ?
        LIMIT 1`,
      [identifier, identifier],
    )
  },

  async createTempCustomer(
    db: Database,
    input: { name: string; phone: string; email: string | null },
  ): Promise<CustomerByIdentifierRow> {
    const result = await db.execute(
      `INSERT INTO ${TABLES.customers} (name, phone, email, type, status, consent_accepted_at)
       VALUES (?, ?, ?, 'INDIVIDUAL', 'TEMP', CURRENT_TIMESTAMP)`,
      [input.name, input.phone, input.email],
    )

    const id = result.insertId
    if (!id) throw new Error("Customer insert returned no id")

    return {
      id,
      name: input.name,
      phone: input.phone,
      email: input.email,
      status: "TEMP",
    }
  },

  async activateCustomer(
    db: Database,
    customerId: Id,
  ): Promise<{ id: string; name: string; phone: string; email: string | null; status: "ACTIVE" }> {
    await db.execute(
      `UPDATE ${TABLES.customers}
          SET status = 'ACTIVE', activated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [customerId],
    )

    const row = await db.queryOne<CustomerByIdentifierRow>(
      `SELECT id, name, phone, email, status FROM ${TABLES.customers} WHERE id = ? LIMIT 1`,
      [customerId],
    )

    if (!row) throw new Error("Customer disappeared between update and read")

    return { ...row, status: "ACTIVE" }
  },

  async upsertCustomerName(db: Database, customerId: Id, name: string): Promise<void> {
    await db.execute(`UPDATE ${TABLES.customers} SET name = ? WHERE id = ?`, [name, customerId])
  },

  async touchLastLogin(db: Database, userId: Id): Promise<void> {
    // `updated_at` is ON UPDATE CURRENT_TIMESTAMP, so this records the activity.
    await db.execute(`UPDATE ${TABLES.users} SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      userId,
    ])
  },

  async findCustomerById(
    db: Database,
    customerId: Id,
  ): Promise<{ id: string; name: string; phone: string; email: string | null } | null> {
    const row = await db.queryOne<CustomerByIdentifierRow>(
      `SELECT id, name, phone, email, status FROM ${TABLES.customers} WHERE id = ? LIMIT 1`,
      [customerId],
    )
    if (!row) return null
    return { id: toId(row.id), name: row.name, phone: row.phone, email: toStringOrNull(row.email) }
  },
}

export type AuthRepository = typeof authRepository
