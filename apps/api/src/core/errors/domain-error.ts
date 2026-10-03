import { ERROR_CODES, ERROR_STATUS, type ErrorCode } from "./error-codes"

export type ErrorDetail = {
  /** Dotted path of the offending field, e.g. `weight`. */
  field?: string
  message: string
  [key: string]: unknown
}

export type DomainErrorOptions = {
  status?: number
  details?: ErrorDetail[]
  cause?: unknown
}

/**
 * The one failure type services throw.
 *
 * Transport maps it to HTTP while **preserving `code`**. Never wrap it as a bare
 * `new Error(message)` — that is exactly the pattern that strips the code and
 * leaves clients guessing.
 */
export class DomainError extends Error {
  override readonly name = "DomainError"

  readonly code: ErrorCode
  readonly status: number
  readonly details?: ErrorDetail[]

  constructor(code: ErrorCode, message: string, options: DomainErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.code = code
    this.status = options.status ?? ERROR_STATUS[code]
    if (options.details && options.details.length > 0) this.details = options.details
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}

export function notFound(message: string): DomainError {
  return new DomainError(ERROR_CODES.NOT_FOUND, message)
}

export function forbidden(message = "You do not have access to this resource"): DomainError {
  return new DomainError(ERROR_CODES.FORBIDDEN, message)
}

export function invalidTransition(message: string): DomainError {
  return new DomainError(ERROR_CODES.INVALID_STATE_TRANSITION, message)
}

function isMySqlError(error: unknown): error is {
  errno: number
  code: string
  sqlMessage?: string
} {
  return error != null && typeof error === "object" && "errno" in error
}

/**
 * Translates a persistence failure into a domain error.
 *
 * The unique-violation branch is what makes "phone already registered" and
 * "this email is taken" return a clean 409 instead of leaking a driver message.
 */
export function fromDatabaseError(error: unknown, context?: string): DomainError {
  if (isDomainError(error)) return error
  if (!isMySqlError(error)) {
    return new DomainError(ERROR_CODES.DATABASE_ERROR, "A database error occurred", {
      cause: error,
    })
  }

  const errno = error.errno

  // 1062 = duplicate entry (unique constraint), 23xxx class = integrity constraint
  if (errno === 1062 || (typeof error.code === "string" && error.code.startsWith("23"))) {
    return new DomainError(
      ERROR_CODES.ALREADY_EXISTS,
      context ? `${context} already exists` : "That record already exists",
      { cause: error },
    )
  }

  // 1451 = cannot add / update a child row, 1452 = cannot update a child row
  if (errno === 1451 || errno === 1452) {
    return new DomainError(ERROR_CODES.VALIDATION_FAILED, "A referenced record does not exist", {
      cause: error,
    })
  }

  // 1040/1041 = no connection/too many connections, 1205/1213 = lock wait/timeout
  if (
    errno === 1040 ||
    errno === 1041 ||
    errno === 1205 ||
    errno === 1213 ||
    error.code === "ETIMEDOUT" ||
    error.code === "ECONNREFUSED"
  ) {
    return new DomainError(ERROR_CODES.SERVICE_UNAVAILABLE, "The database is unavailable", {
      cause: error,
    })
  }

  return new DomainError(ERROR_CODES.DATABASE_ERROR, "A database error occurred", {
    cause: error,
  })
}
