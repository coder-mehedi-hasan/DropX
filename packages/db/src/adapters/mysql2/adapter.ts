import mysql, {
  type Pool,
  type PoolConnection,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

import type {
  Database,
  DatabaseConfig,
  Dialect,
  Id,
  QueryResult,
  SqlParams,
  Transaction,
  TransactionOptions,
} from "../../port/database";
import { DatabaseError } from "../../port/errors";
import { toDatabaseError } from "./errors";
import { parseMySqlUrl, type MySqlConnectionConfig } from "./parse-url";

/**
 * mysql2 implementation of the `Database` port.
 *
 * The port is the contract; everything MySQL-shaped stays in this folder.
 * Placeholders are already `?` for this driver — `toNativeSql` is the seam a
 * Postgres adapter would use to rewrite them to `$1..$n`.
 */
const DIALECT: Dialect = "mysql";

/** Raw driver result: a row set for SELECT, a header for writes. */
type RawResult = ResultSetHeader | RowDataPacket[];

type QueryRunner = (sql: string, values: unknown[]) => Promise<RawResult>;

function toNativeSql(sql: string): string {
  return sql;
}

function normalizeParams(params: SqlParams | undefined): unknown[] {
  if (!params) return [];
  // `undefined` is not bindable; repositories omit such columns instead.
  return params.map((value) => (value === undefined ? null : value));
}

function buildPoolOptions(
  config: MySqlConnectionConfig,
  pool: DatabaseConfig["pool"],
): PoolOptions {
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: config.charset,
    ssl: config.ssl,
    supportBigNumbers: config.supportBigNumbers,
    bigNumberStrings: config.bigNumberStrings,
    dateStrings: config.dateStrings,
    waitForConnections: true,
    connectionLimit: pool?.max ?? 10,
    maxIdle: pool?.max ?? 10,
    idleTimeout: pool?.idleTimeoutMillis ?? 60_000,
    connectTimeout: pool?.connectTimeoutMillis ?? 10_000,
    enableKeepAlive: true,
    timezone: "Z",
    multipleStatements: false,
    namedPlaceholders: false,
  };
}

function normalizeInsertId(value: number | bigint | string | null | undefined): Id | null {
  if (value === null || value === undefined || value === 0) return null;
  return String(value);
}

function toQueryResult<T>(result: RawResult): QueryResult<T> {
  if (Array.isArray(result)) {
    return { rows: result as T[], affectedRows: result.length, insertId: null };
  }
  return {
    rows: [],
    affectedRows: result.affectedRows ?? 0,
    insertId: normalizeInsertId(result.insertId),
  };
}

/** Shared query implementation over a pool or a checked-out connection. */
function createExecutor(run: QueryRunner, dialect: Dialect) {
  return {
    dialect,

    async query<T = Record<string, unknown>>(
      sql: string,
      params?: SqlParams,
    ): Promise<QueryResult<T>> {
      try {
        const result = await run(toNativeSql(sql), normalizeParams(params));
        return toQueryResult<T>(result);
      } catch (error) {
        throw toDatabaseError(error, sql);
      }
    },

    async queryOne<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T | null> {
      const { rows } = await this.query<T>(sql, params);
      return rows[0] ?? null;
    },

    async execute(sql: string, params?: SqlParams): Promise<QueryResult<never>> {
      return this.query<never>(sql, params);
    },

    async count(sql: string, params?: SqlParams): Promise<number> {
      const row = await this.queryOne<Record<string, unknown>>(sql, params);
      if (!row) return 0;
      const first = Object.values(row)[0];
      const parsed = typeof first === "number" ? first : Number(first);
      return Number.isFinite(parsed) ? parsed : 0;
    },
  };
}

function poolRunner(pool: Pool): QueryRunner {
  return async (sql, values) => {
    const [result] = await pool.query(sql, values);
    return result as RawResult;
  };
}

function connectionRunner(connection: PoolConnection): QueryRunner {
  return async (sql, values) => {
    const [result] = await connection.query(sql, values);
    return result as RawResult;
  };
}

function createTransaction(connection: PoolConnection): Transaction {
  return { ...createExecutor(connectionRunner(connection), DIALECT), dialect: DIALECT };
}

export type MySqlDatabase = Database & {
  /** Escape hatch for driver-specific work. Feature code should use the port. */
  readonly pool: Pool;
};

export function createMySqlDatabase(config: DatabaseConfig): MySqlDatabase {
  const parsed = parseMySqlUrl(config.url);
  const pool = mysql.createPool(buildPoolOptions(parsed, config.pool));

  return {
    ...createExecutor(poolRunner(pool), DIALECT),
    dialect: DIALECT,
    pool,

    async transaction<T>(
      fn: (tx: Transaction) => Promise<T>,
      options: TransactionOptions = {},
    ): Promise<T> {
      let connection: PoolConnection;
      try {
        connection = await pool.getConnection();
      } catch (error) {
        throw toDatabaseError(error);
      }

      try {
        if (options.isolation) {
          await connection.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolation}`);
        }
        if (options.readOnly) {
          await connection.query("SET TRANSACTION READ ONLY");
        }

        await connection.beginTransaction();
        const value = await fn(createTransaction(connection));
        await connection.commit();
        return value;
      } catch (error) {
        try {
          await connection.rollback();
        } catch {
          // The connection is already unusable; the original error is the useful one.
        }
        throw error instanceof DatabaseError ? error : toDatabaseError(error);
      } finally {
        connection.release();
      }
    },

    async ping(): Promise<void> {
      try {
        await pool.query("SELECT 1");
      } catch (error) {
        throw toDatabaseError(error);
      }
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}
