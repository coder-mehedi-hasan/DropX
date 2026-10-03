#!/usr/bin/env bun
/**
 * Seeds roles and their default permission grants.
 *
 * Permission keys are imported from `src/shared/auth/permissions` — the database
 * only records which keys each role holds, so this is where code and
 * `role_permissions` are reconciled. Safe to re-run: grants are inserted with
 * `INSERT IGNORE`, and a role later edited in the admin keeps its extra keys.
 */
import mysql from "mysql2/promise"

import { closePool } from "../src/db/pool"
import { TABLES, type Id } from "../src/db/models"

import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_GRANTS,
  type PermissionKey,
} from "../src/shared/auth/permissions"

async function seedRole(pool: mysql.Pool, name: string): Promise<Id> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM ${TABLES.roles} WHERE name = ? LIMIT 1`,
    [name],
  )
  const existing = rows[0]
  if (existing) return String(existing.id)

  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO ${TABLES.roles} (name, description) VALUES (?, ?)`,
    [name, null],
  )

  if (!result.insertId) throw new Error(`Failed to insert role ${name}`)
  return String(result.insertId)
}

async function grant(pool: mysql.Pool, roleId: Id, permissionKey: PermissionKey): Promise<boolean> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT IGNORE INTO ${TABLES.rolePermissions} (role_id, permission_key) VALUES (?, ?)`,
    [roleId, permissionKey],
  )
  return result.affectedRows > 0
}

/** Catches a key that was revoked in code but still granted in the database. */
async function reportOrphanedGrants(pool: mysql.Pool): Promise<void> {
  const placeholders = ALL_PERMISSION_KEYS.map(() => "?").join(", ")
  const [orphans] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT DISTINCT permission_key
       FROM ${TABLES.rolePermissions}
      WHERE permission_key NOT IN (${placeholders})`,
    ALL_PERMISSION_KEYS,
  )

  if (orphans.length === 0) return

  console.warn(
    `⚠ ${orphans.length} granted key(s) are no longer in the code catalog:\n  ${orphans
      .map((row) => row.permission_key)
      .join("\n  ")}`,
  )
}

async function main(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set")
  }

  const pool = mysql.createPool(DATABASE_URL)

  try {
    console.log("· seeding roles")

    let totalGrants = 0
    const roleNames = Object.keys(DEFAULT_ROLE_GRANTS)

    for (const name of roleNames) {
      const keys = DEFAULT_ROLE_GRANTS[name] ?? []
      const roleId = await seedRole(pool, name)

      let added = 0
      for (const key of keys) {
        if (await grant(pool, roleId, key)) added += 1
      }

      totalGrants += added
      console.log(`  ${name.padEnd(16)} ${String(keys.length).padStart(3)} key(s) — ${added} new`)
    }

    await reportOrphanedGrants(pool)

    console.log(`· ${totalGrants} grant(s) inserted`)
    console.log("✓ done")
  } finally {
    await closePool(pool)
  }
}

main().catch((error: unknown) => {
  console.error("✗ seeding failed")
  console.error(error)
  process.exit(1)
})
