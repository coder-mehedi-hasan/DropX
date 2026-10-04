import type { PoolOptions } from "mysql2"
import * as mysqlCore from "mysql2"
import mysql from "mysql2/promise"

/**
 * mysql2's typings declare `ConnectionConfig` as an interface, so the class it
 * ships at runtime cannot be imported as a value. Reaching it through a cast is
 * what lets the pool keep mysql2's own URL parser instead of hand-rolling one.
 */
const { ConnectionConfig } = mysqlCore as unknown as {
  ConnectionConfig: { parseUrl(url: string): PoolOptions }
}

/**
 * The only database the API talks to.
 *
 * Single MySQL pool — no driver registry, no vendor abstraction. It is created
 * once at boot (lazily, so tests and tooling pay nothing for importing) and
 * bound to every request as `c.db`. Repositories run raw SQL against it:
 *
 *   const [rows] = await c.db.query(sql, params)
 *   const [result] = await c.db.execute(sql, params)
 */
const DATABASE_URL = process.env.DATABASE_URL

export function createPool(): mysql.Pool {
  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. " +
        "Copy .env.example to .env and fill in the mysql connection string.",
    )
  }

  // Every timestamp column is DATETIME, which carries no zone of its own, so
  // mysql2 has to assume one when it builds a Date. Left unset it assumes
  // `'local'` — the machine's TZ — which silently shifts every timestamp by
  // that offset. `'Z'` reads them as UTC, matching the server's CURRENT_TIMESTAMP.
  // Set here rather than via TZ=UTC in package.json so no script can omit it.
  return mysql.createPool({ ...ConnectionConfig.parseUrl(DATABASE_URL), timezone: "Z" })
}

export const pool = createPool()

export async function closePool(p: mysql.Pool): Promise<void> {
  await p.end()
}
