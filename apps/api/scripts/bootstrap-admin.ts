#!/usr/bin/env bun
/**
 * Creates the first console administrator.
 *
 * Nothing else can: the console login reads `users`, and no module, screen or
 * seed writes that table, so a fresh database has no way in. The first account
 * has to come from a script; every account after it belongs in the console's
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
import {
  closeDatabase,
  createDatabaseWith,
  resolveDatabaseConfig,
  TABLES,
  type Id,
} from "@dropx/db"

import { hashPassword } from "../src/core/crypto/password"
import { DEFAULT_ROLE_GRANTS } from "../src/shared/auth/permissions"


const db = createDatabaseWith(resolveDatabaseConfig())

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

  const role = await db.queryOne<{ id: Id }>(
    `SELECT id FROM ${TABLES.roles} WHERE name = ? LIMIT 1`,
    [roleName],
  )

  if (!role) {
    console.error("✗ no roles in the database — run `bun run db:seed` first, then this again")
    process.exit(1)
  }

  const existing = await db.queryOne<{ id: Id; status: string }>(
    `SELECT id, status FROM ${TABLES.users} WHERE email = ? LIMIT 1`,
    [email],
  )

  if (existing) {
    console.log(`· ${email} already exists (status ${existing.status}) — nothing changed`)
    console.log("  To make a different account an admin, use another email.")
    return
  }

  // scrypt before the transaction: it is deliberately slow, and holding a
  // connection open across it would needlessly narrow the pool.
  const passwordHash = await hashPassword(password)

  const userId = await db.transaction(async (tx) => {
    const inserted = await tx.execute(
      `INSERT INTO ${TABLES.users} (name, email, password_hash, status)
       VALUES (?, ?, ?, 'ACTIVE')`,
      [name, email, passwordHash],
    )

    if (!inserted.insertId) throw new Error("Failed to insert the admin user")

    await tx.execute(`INSERT INTO ${TABLES.userRoles} (user_id, role_id) VALUES (?, ?)`, [
      inserted.insertId,
      role.id,
    ])

    return inserted.insertId
  })

  console.log(`✓ created admin #${userId} — ${name} <${email}> with the ${roleName} role`)
  console.log("  sign in at http://localhost:5173/login")
}

main()
  .then(() => closeDatabase())
  .catch(async (error: unknown) => {
    console.error(error)
    await closeDatabase()
    process.exitCode = 1
  })
