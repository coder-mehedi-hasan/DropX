import { DatabaseError, type DatabaseErrorCode } from "../../port/errors";

type MysqlError = {
  code?: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
  message?: string;
};

const ERROR_CODES: Readonly<Record<string, DatabaseErrorCode>> = {
  ER_DUP_ENTRY: "UNIQUE_VIOLATION",
  ER_DUP_ENTRY_WITH_KEY_NAME: "UNIQUE_VIOLATION",
  ER_DUP_KEY: "UNIQUE_VIOLATION",
  ER_NO_REFERENCED_ROW: "FOREIGN_KEY_VIOLATION",
  ER_NO_REFERENCED_ROW_2: "FOREIGN_KEY_VIOLATION",
  ER_ROW_IS_REFERENCED: "FOREIGN_KEY_VIOLATION",
  ER_ROW_IS_REFERENCED_2: "FOREIGN_KEY_VIOLATION",
  ER_NO_REFERENCED_ROW2: "FOREIGN_KEY_VIOLATION",
  ER_CHECK_CONSTRAINT_VIOLATED: "CHECK_VIOLATION",
  ER_LOCK_DEADLOCK: "TRANSACTION_ABORTED",
  ER_LOCK_WAIT_TIMEOUT: "TRANSACTION_ABORTED",
  ER_LOCK_TABLE_FULL: "TRANSACTION_ABORTED",
  PROTOCOL_CONNECTION_LOST: "CONNECTION_FAILED",
  ECONNREFUSED: "CONNECTION_FAILED",
  ECONNRESET: "CONNECTION_FAILED",
  ETIMEDOUT: "TIMEOUT",
  ER_CON_COUNT_ERROR: "CONNECTION_FAILED",
};

const MYSQL_ERRNOS: Readonly<Record<number, DatabaseErrorCode>> = {
  1062: "UNIQUE_VIOLATION",
  1451: "FOREIGN_KEY_VIOLATION",
  1452: "FOREIGN_KEY_VIOLATION",
  1213: "TRANSACTION_ABORTED",
  1205: "TRANSACTION_ABORTED",
  1040: "CONNECTION_FAILED",
  1203: "CONNECTION_FAILED",
};

const CONNECTION_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"]);

export function isConnectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code } = error as MysqlError;
  return typeof code === "string" && CONNECTION_CODES.has(code);
}

/**
 * Normalises a driver failure into a `DatabaseError` with a stable code.
 *
 * The raw message can contain column values, so only the driver's own summary
 * is preserved. `apps/api` maps `code` onto its domain errors and never leaks
 * `message` internals to a client.
 */
export function toDatabaseError(error: unknown, sql?: string): DatabaseError {
  if (error instanceof DatabaseError) return error;

  const driver = (typeof error === "object" && error !== null ? error : {}) as MysqlError;
  const byCode = driver.code ? ERROR_CODES[driver.code] : undefined;
  const byErrno = driver.errno ? MYSQL_ERRNOS[driver.errno] : undefined;
  const code: DatabaseErrorCode = byCode ?? byErrno ?? "QUERY_FAILED";

  const detail = driver.sqlMessage ?? driver.message ?? "Database query failed";

  return new DatabaseError(code, detail, { cause: error, sql });
}
