#!/usr/bin/env bun
/**
 * Creates the first administrator.
 *
 * Nothing else can: the admin login reads `users`, and no module, screen or
 * seed writes that table, so a fresh database has no way in. The first account
 * has to come from a script; every account after it belongs in the admin's
 * staff screen.
 *
 * Deliberately idempotent in the safe direction — an email that already exists is
 * left completely untouched, so re-running (in CI, or by accident) can never
 * reset a password. Change the email to create a second admin.
 *
 * Reads `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` from `.env`;
 * `BOOTSTRAP_ADMIN_NAME` is optional. Roles must already be seeded
 * (`bun run db:seed`), since the grant is what makes the account an admin.
 */
import mysql from "mysql2/promise"

import { closePool } from "../src/db/pool"
import { withTransaction } from "../src/db/transaction"

import bcrypt from "bcryptjs"
import { DEFAULT_ROLE_GRANTS } from "../src/shared/auth/permissions"
import { TABLES, type Id } from "../src/db/models"

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`✗ ${name} is not set — add it to .env and run this again`)
    process.exit(1)
  }
  return value
}

async function main(): Promise<void> {
  const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase()
  const password = required("BOOTSTRAP_ADMIN_PASSWORD")
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Administrator"

  const roleName = "ADMIN"
  if (!DEFAULT_ROLE_GRANTS[roleName]) {
    throw new Error(`ADMIN is no longer a role in the code catalog`)
  }

  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set")
  }

  const pool = mysql.createPool(DATABASE_URL)

  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(`SELECT id FROM ${TABLES.roles} WHERE name = ? LIMIT 1`, [
      roleName,
    ])
    const role = rows[0] as { id: Id } | undefined

    if (!role) {
      console.error("✗ no roles in the database — run `bun run db:seed` first, then this again")
      process.exit(1)
    }

    const [existingRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, status FROM ${TABLES.users} WHERE email = ? LIMIT 1`,
      [email],
    )
    const existing = existingRows[0] as { id: Id; status: string } | undefined

    if (existing) {
      console.log(`· ${email} already exists (status ${existing.status}) — nothing changed`)
      console.log("  To make a different account an admin, use another email.")
      return
    }

    // bcrypt before the transaction: it is deliberately slow, and holding a
    // connection open across it would needlessly narrow the pool.
    const passwordHash = await bcrypt.hash(password, 10)

    const userId = await withTransaction(pool, async (tx) => {
      const [result] = await tx.execute<mysql.OkPacket>(
        `INSERT INTO ${TABLES.users} (name, email, password_hash, status)
         VALUES (?, ?, ?, 'ACTIVE')`,
        [name, email, passwordHash],
      )

      if (!result.insertId) throw new Error("Failed to insert the admin user")

      await tx.execute(
        `INSERT INTO ${TABLES.userRoles} (user_id, role_id) VALUES (?, ?)`,
        [String(result.insertId), role.id],
      )

      return String(result.insertId)
    })

    console.log(`✓ created admin #${userId} — ${name} <${email}> with the ${roleName} role`)
    console.log("  sign in at http://localhost:5173/login")
  } finally {
    await closePool(pool)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})