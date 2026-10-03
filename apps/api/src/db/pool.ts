import mysql from "mysql2/promise"

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

  return mysql.createPool(DATABASE_URL)
}

export const pool = createPool()

export async function closePool(p: mysql.Pool): Promise<void> {
  await p.end()
}
