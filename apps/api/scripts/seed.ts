#!/usr/bin/env bun
/**
 * Seeds roles and their default permission grants.
 *
 * Permission keys are imported from `src/shared/auth/permissions` — the database
 * only records which keys each role holds, so this is where code and
 * `role_permissions` are reconciled. Safe to re-run: grants are inserted with
 * `INSERT IGNORE`, and a role later edited in the admin keeps its extra keys.
 */
import {
  closeDatabase,
  createDatabaseWith,
  resolveDatabaseConfig,
  TABLES,
  type Id,
} from "@dropx/db"

import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_GRANTS,
  type PermissionKey,
} from "../src/shared/auth/permissions"

const ROLE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  ADMIN: "Full company scope across all branches and hubs",
  BRANCH_MANAGER: "Scoped to a single branch",
  HUB_OPERATOR: "Scoped to assigned hubs via user_hubs",
  DISPATCHER: "Assigns pickups and deliveries across hubs in scope",
  SUPPORT: "Customer, parcel and ticket support",
  FINANCE: "Payments, settlements and pricing visibility",
  RIDER: "Rider app jobs, location and delivery proof",
}

const db = createDatabaseWith(resolveDatabaseConfig())

async function seedRole(name: string): Promise<Id> {
  const existing = await db.queryOne<{ id: string }>(
    `SELECT id FROM ${TABLES.roles} WHERE name = ? LIMIT 1`,
    [name],
  )

  if (existing) return existing.id

  const result = await db.execute(`INSERT INTO ${TABLES.roles} (name, description) VALUES (?, ?)`, [
    name,
    ROLE_DESCRIPTIONS[name] ?? null,
  ])

  if (!result.insertId) throw new Error(`Failed to insert role ${name}`)
  return result.insertId
}

async function grant(roleId: Id, permissionKey: PermissionKey): Promise<boolean> {
  const result = await db.execute(
    `INSERT IGNORE INTO ${TABLES.rolePermissions} (role_id, permission_key) VALUES (?, ?)`,
    [roleId, permissionKey],
  )
  return result.affectedRows > 0
}

/** Catches a key that was revoked in code but still granted in the database. */
async function reportOrphanedGrants(): Promise<void> {
  const placeholders = ALL_PERMISSION_KEYS.map(() => "?").join(", ")
  const orphans = await db.query<{ permission_key: string }>(
    `SELECT DISTINCT permission_key
       FROM ${TABLES.rolePermissions}
      WHERE permission_key NOT IN (${placeholders})`,
    ALL_PERMISSION_KEYS,
  )

  if (orphans.rows.length === 0) return

  console.warn(
    `⚠ ${orphans.rows.length} granted key(s) are no longer in the code catalog:\n  ${orphans.rows
      .map((row) => row.permission_key)
      .join("\n  ")}`,
  )
}

async function main(): Promise<void> {
  console.log("· seeding roles")

  let totalGrants = 0
  const roleNames = Object.keys(DEFAULT_ROLE_GRANTS)

  for (const name of roleNames) {
    const keys = DEFAULT_ROLE_GRANTS[name] ?? []
    const roleId = await seedRole(name)

    let added = 0
    for (const key of keys) {
      if (await grant(roleId, key)) added += 1
    }

    totalGrants += added
    console.log(`  ${name.padEnd(16)} ${String(keys.length).padStart(3)} key(s) — ${added} new`)
  }

  console.log(`✓ seeded ${roleNames.length} role(s), ${totalGrants} new grant(s)`)
  await reportOrphanedGrants()
}

main()
  .then(() => closeDatabase())
  .catch(async (error: unknown) => {
    console.error(error)
    await closeDatabase()
    process.exitCode = 1
  })
