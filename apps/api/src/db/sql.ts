/**
 * Row decoders and list-query scaffolding shared by every repository.
 *
 * These lived in each repository file, which meant three copies of each by the
 * third feature and a fourth the moment pricing rules landed. A copy is worse
 * than no helper here: the DATETIME one in particular was fixed in one place
 * while the others kept a bare `as Date` cast, so the same column decoded two
 * different ways depending on which table it came from. One definition, one
 * behaviour — and a fix that reaches every table at once.
 */

import type { Connection, Pool, RowDataPacket } from "mysql2/promise"
import type { ListParams } from "./models"

/**
 * mysql2 hands back a `Date` for a DATETIME unless the pool asks for
 * `dateStrings`, so a decoder cannot assume a `"YYYY-MM-DD HH:MM:SS"` string and
 * call `.replace` on it. Both shapes are accepted; a `Date` is already the right
 * instant because the pool reads DATETIMEs as UTC (`timezone: "Z"` in
 * `./pool.ts`), which is what the string form compensates for by appending `Z`.
 */
export function toUtcDate(value: string | Date): Date {
  if (value instanceof Date) return value
  return new Date(`${value.replace(" ", "T")}Z`)
}

/** DECIMAL/BIGINT come back as strings to protect precision; the model says number. */
export function toDecimal(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

/** A NULL column must stay distinguishable from a zero, so it maps to `null`. */
export function toNullableDecimal(value: unknown): number | null {
  return value === null || value === undefined ? null : toDecimal(value)
}

export function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

/**
 * Neutralises LIKE wildcards in a user-supplied search term.
 *
 * A `%` in the search box would otherwise match every row, and the results would
 * look like a bug rather than a filter. MySQL's LIKE takes a backslash as the
 * default escape character, so escaping with one is enough — no `ESCAPE` clause.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

/**
 * Assembles a WHERE clause from already-built clauses.
 *
 * Returns a **bare parenthesised expression**, not a complete `WHERE (…)`. The
 * distinction is load-bearing: the same clauses are reused by the count query and
 * the page query, and the count query needs to slot its own `FROM` first. An
 * earlier version returned the whole `WHERE (…)` and callers wrapped it again,
 * producing `WHERE (WHERE (…))` — a syntax error on every query that combined a
 * scope clause with a filter.
 */
export function whereClause(clauses: string[]): string {
  return clauses.length ? `WHERE (${clauses.join(") AND (")})` : ""
}

/**
 * Resolves a client-supplied `sortBy` against a per-table allowlist.
 *
 * A sort column arrives from the query string, so interpolating it unchecked is
 * injection. Returning `undefined` for an unknown key lets the caller fall back
 * to its default ordering instead of erroring, which is what the validator's
 * rejection of an unknown key already guarantees.
 */
export function sortColumnOf(params: ListParams, allowed: readonly string[]): string | undefined {
  return params.sortBy && allowed.includes(params.sortBy) ? params.sortBy : undefined
}

/**
 * `ORDER BY` with a stable tiebreak.
 *
 * The sort column alone is not enough: two rows with the same value can come back
 * in any order, so paging through them can show a row twice and skip another. The
 * appended unique columns make the ordering total.
 */
export function orderByClauseOf(
  sortColumn: string | undefined,
  direction: "asc" | "desc",
  tiebreak: string,
): string {
  return sortColumn ? `${sortColumn} ${direction.toUpperCase()}, ${tiebreak}` : tiebreak
}

/**
 * Runs a count query and its page query, returning the `{ nodes, totalCount }` pair
 * a service turns into a `Page`.
 *
 * Both queries take the same `where` clause and the same bound filter params —
 * `filterParams` is spread ahead of `LIMIT`/`OFFSET` because the driver's
 * placeholders are positional and a filter value arriving after the page size
 * would bind to the wrong clause.
 */
export async function pageOf<T>(
  db: Pool | Connection,
  options: {
    /** `SELECT <cols> FROM <table> [JOIN …] <where> ORDER BY … LIMIT ? OFFSET ?` */
    pageSql: string
    /** `SELECT COUNT(*) AS count FROM <table> [JOIN …] <where>` — same table/alias as `pageSql`. */
    countSql: string
    /** The filter values bound into `where`, in clause order. */
    filterParams: readonly unknown[]
    params: ListParams
    decode: (row: Record<string, unknown>) => T
  },
): Promise<{ nodes: T[]; totalCount: number }> {
  const { pageSql, countSql, filterParams, params, decode } = options
  const [countRows] = await db.query<RowDataPacket[]>(countSql, [...filterParams])
  const [rows] = await db.query<RowDataPacket[]>(pageSql, [
    ...filterParams,
    params.limit,
    params.offset,
  ])
  const countRow = countRows[0]
  const totalCount = countRow?.count == null ? 0 : Number(countRow.count)
  return { nodes: rows.map(decode), totalCount }
}
