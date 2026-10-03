import type { Connection, Pool } from "mysql2/promise"

/**
 * Runs a callback in a single MySQL transaction.
 *
 * A connection is checked out of the pool for the whole duration, begin/commit/
 * rollback is manual so failures surface as ordinary errors. Non-SQL I/O must
 * not run inside the callback — the connection stays held otherwise.
 */
export async function withTransaction<T>(
  db: Pool,
  fn: (conn: Connection) => Promise<T>,
): Promise<T> {
  const conn = await db.getConnection()

  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
