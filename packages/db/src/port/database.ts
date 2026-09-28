/**
 * Port: the narrow surface every database driver must satisfy.
 *
 * Nothing in here mentions MySQL, mysql2, or any vendor. Drivers under
 * `src/adapters/*` translate the port into their own wire protocol, so a
 * Postgres/ClickHouse adapter can be dropped in without touching feature code.
 */

/** Primary keys are `BIGINT UNSIGNED`; they are carried as strings end-to-end. */
export type Id = string

/** A value the driver is allowed to bind to a placeholder. */
export type SqlPrimitive = string | number | bigint | boolean | Date | Buffer | null | undefined

export type SqlParams = readonly SqlPrimitive[]

/** Vendor identifier for the bound connection. Feature code must not branch on it. */
export type Dialect = "mysql" | "postgres" | "sqlite" | "unknown"

export type IsolationLevel =
  "READ UNCOMMITTED" | "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE"

export type QueryResult<T> = {
  rows: T[]
  /** 0 for SELECT; matched/inserted/changed rows otherwise. */
  affectedRows: number
  /** Stringified so 64-bit ids never lose precision in JS. */
  insertId: Id | null
}

export type TransactionOptions = {
  isolation?: IsolationLevel
  readOnly?: boolean
}

/**
 * The read/write capability shared by a pool and an open transaction.
 * Services depend on this, never on a driver.
 */
export interface Executor {
  /** Runs any statement. Throws `DatabaseError` on failure. */
  query<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<QueryResult<T>>
  /** First row or `null`. Keeps feature code free of `rows[0]` + cast noise. */
  queryOne<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T | null>
  /** Convenience for INSERT/UPDATE/DELETE. */
  execute(sql: string, params?: SqlParams): Promise<QueryResult<never>>
  /** `SELECT COUNT(*)` against the same projection/filters as a list query. */
  count(sql: string, params?: SqlParams): Promise<number>
}

export interface Transaction extends Executor {
  readonly dialect: Dialect
}

export interface Database extends Executor {
  readonly dialect: Dialect
  /**
   * Runs `fn` inside a transaction, committing on resolve and rolling back on
   * throw. Never wrap slow third-party I/O in here.
   */
  transaction<T>(fn: (tx: Transaction) => Promise<T>, options?: TransactionOptions): Promise<T>
  ping(): Promise<void>
  close(): Promise<void>
}

export type DatabaseFactory = (config: DatabaseConfig) => Database

export type DatabaseConfig = {
  /** Driver id, e.g. `mysql`. Resolved by the adapter registry. */
  driver: string
  /** Driver-native connection string, passed through untouched. */
  url: string
  /** Applied to a pool when the driver supports one. */
  pool?: {
    min?: number
    max?: number
    idleTimeoutMillis?: number
    connectTimeoutMillis?: number
  }
}
