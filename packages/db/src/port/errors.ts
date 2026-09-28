/**
 * Stable database-level failure codes.
 *
 * `apps/api` maps these onto its own `DomainError` codes; the raw driver error
 * (and any bound values) never reaches a client.
 */
export type DatabaseErrorCode =
  | "UNIQUE_VIOLATION"
  | "FOREIGN_KEY_VIOLATION"
  | "NOT_FOUND_VIOLATION"
  | "CHECK_VIOLATION"
  | "CONNECTION_FAILED"
  | "TIMEOUT"
  | "QUERY_FAILED"
  | "TRANSACTION_ABORTED"
  | "UNSUPPORTED_DRIVER"

export class DatabaseError extends Error {
  override readonly name = "DatabaseError"

  constructor(
    readonly code: DatabaseErrorCode,
    message: string,
    readonly options: { cause?: unknown; sql?: string } = {},
  ) {
    super(message, { cause: options.cause })
  }

  /** Unique-constraint name from the driver, when it exposes one. */
  get constraint(): string | undefined {
    const cause = this.cause as { constraint?: unknown; sqlMessage?: unknown } | undefined
    const value = cause?.constraint ?? cause?.sqlMessage
    return typeof value === "string" ? value : undefined
  }
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError
}

/** Duplicate-key lookup is driver-agnostic; both vendor codes are recognised. */
export function isUniqueViolation(error: unknown): boolean {
  return isDatabaseError(error) && error.code === "UNIQUE_VIOLATION"
}

export function isForeignKeyViolation(error: unknown): boolean {
  return isDatabaseError(error) && error.code === "FOREIGN_KEY_VIOLATION"
}
