import type { Connection, OkPacket, Pool } from "mysql2/promise"

/**
 * Server-assigned sequential codes: `RDR-0001`, `CUS-0001`, `SET-0001`.
 *
 * MySQL has no sequences, so each name owns a row in the `sequences` table and
 * a claim is one atomic statement — the row lock serialises concurrent writers
 * and `LAST_INSERT_ID()` hands the new value back in the same round trip. The
 * row is seeded by `migrate.sql`, so the insert branch below only fires if a
 * counter row has been deleted out from under the app.
 *
 * Pass the caller's transaction handle when there is one: the claim then
 * participates in that transaction, so a rolled-back insert rolls its number
 * back too and no gap is burned. Callers without a transaction (the OTP path)
 * draw from the pool directly and may leave gaps on a failed insert — which is
 * fine, a gap in a reference code is not a defect, a duplicate is.
 *
 * Codes are assigned once and are never editable afterwards. That invariant is
 * what keeps a hand-typed number from ever colliding with the next one the
 * counter hands out.
 */

/** The counters that exist. Adding one means adding a row in `migrate.sql`. */
export type SequenceName = "rider" | "customer" | "settlement"

const SEQUENCE_FORMAT: Record<SequenceName, { prefix: string; width: number }> = {
  rider: { prefix: "RDR", width: 4 },
  customer: { prefix: "CUS", width: 4 },
  settlement: { prefix: "SET", width: 4 },
}

/**
 * Draws the next number for `name` and returns it.
 *
 * Four digits matches the codes already in the database (`RDR-1001`) and the
 * `RDR-1042` placeholder the admin forms have always shown; a value wider than
 * the pad is returned unpadded rather than truncated.
 */
export async function nextSequenceValue(
  db: Pool | Connection,
  name: SequenceName,
): Promise<number> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO sequences (seq_name, next_value) VALUES (?, 1)
       ON DUPLICATE KEY UPDATE next_value = LAST_INSERT_ID(next_value + 1)`,
    [name],
  )

  // The duplicate-key branch reports the value we handed LAST_INSERT_ID(), which
  // is always >= 1. A first-ever insert reports 0 — the table has no
  // AUTO_INCREMENT column — and wrote 1, so 0 also means 1. `next_value` is NOT
  // NULL and only ever grows, so 0 cannot be a real result.
  return Number(result.insertId) || 1
}

/** Draws the next number for `name` and formats it, e.g. `RDR-0007`. */
export async function nextSequenceCode(db: Pool | Connection, name: SequenceName): Promise<string> {
  const { prefix, width } = SEQUENCE_FORMAT[name]
  const value = await nextSequenceValue(db, name)
  return `${prefix}-${String(value).padStart(width, "0")}`
}
