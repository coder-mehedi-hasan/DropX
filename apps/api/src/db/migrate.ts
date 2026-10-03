#!/usr/bin/env bun
/**
 * Applies `migrate.sql` to the configured database.
 *
 *   bun run migrate            # create anything missing (schema is IF NOT EXISTS)
 *   bun run migrate --reset    # drop every table first, then recreate
 *
 * The schema in `migrate.sql` is the single source of truth, so this is an
 * idempotent "make the database match the file" runner rather than a versioned
 * migration system. Introduce a versioned runner when shipping to production.
 */
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import mysql from "mysql2/promise"

import { TABLES } from "./models"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(SCRIPT_DIR, "migrate.sql")
const DATABASE_URL = process.env.DATABASE_URL

/**
 * Splits a SQL script into statements.
 *
 * Strips `--` line comments and `/* *\/` block comments, then splits on
 * semicolons that are not inside a quoted string. Statement terminators inside
 * string literals would otherwise be cut in half.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ""
  let quote: '"' | "'" | "`" | null = null
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]!
    const next = sql[i + 1]

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false
        current += char
      }
      continue
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false
        i += 1
      }
      continue
    }

    if (quote) {
      current += char
      if (char === "\\" && next) {
        current += next
        i += 1
        continue
      }
      if (char === quote) {
        if (next === quote) {
          current += next
          i += 1
          continue
        }
        quote = null
      }
      continue
    }

    if (char === "-" && next === "-") {
      inLineComment = true
      i += 1
      continue
    }
    if (char === "#") {
      inLineComment = true
      continue
    }
    if (char === "/" && next === "*") {
      inBlockComment = true
      i += 1
      continue
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char
      current += char
      continue
    }
    if (char === ";") {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ""
      continue
    }

    current += char
  }

  const tail = current.trim()
  if (tail) statements.push(tail)
  return statements
}

async function dropAllTables(pool: mysql.Pool): Promise<void> {
  console.log("· dropping existing tables")
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
  )

  for (const { TABLE_NAME: table } of rows) {
    await pool.execute(`DROP TABLE IF EXISTS \`${table}\``)
  }
  console.log(`  dropped ${rows.length} table(s)`)
}

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset")
  if (!DATABASE_URL) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  const pool = mysql.createPool(DATABASE_URL)

  try {
    const [result] = await pool.query("SELECT 1")
    console.log(`· connected (mysql)`, result)

    if (reset) {
      await dropAllTables(pool)
    }

    const sql = await readFile(SCHEMA_PATH, "utf8")
    const statements = splitStatements(sql)

    console.log(`· applying ${statements.length} statement(s) from migrate.sql`)
    for (const statement of statements) {
      try {
        await pool.execute(statement)
      } catch (error) {
        const preview = statement.replace(/\s+/g, " ").slice(0, 90)
        if (error != null && typeof error === "object" && "errno" in error) {
          console.error(`\n✗ mysql error code ${error.errno}: ${(error as { sqlMessage?: string }).sqlMessage}\n  statement: ${preview}…`)
        } else {
          console.error(`\n✗ migration failed\n  statement: ${preview}…`)
        }
        throw error
      }
    }

    const expected = Object.values(TABLES).length
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
    )
    const actual = (rows[0] as { total: number } | undefined)?.total ?? 0
    console.log(`✓ schema applied — ${actual} table(s) present (${expected} expected)`)
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
