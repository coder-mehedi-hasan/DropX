import { DatabaseError } from "@dropx/db"

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

/**
 * Translates a persistence failure into a domain error.
 *
 * The unique-violation branch is what makes "phone already registered" and
 * "this email is taken" return a clean 409 instead of leaking a driver message.
 */
export function fromDatabaseError(error: unknown, context?: string): DomainError {
  if (isDomainError(error)) return error
  if (!(error instanceof DatabaseError)) {
    return new DomainError(ERROR_CODES.DATABASE_ERROR, "A database error occurred", {
      cause: error,
    })
  }

  switch (error.code) {
    case "UNIQUE_VIOLATION":
      return new DomainError(
        ERROR_CODES.ALREADY_EXISTS,
        context ? `${context} already exists` : "That record already exists",
        { cause: error },
      )
    case "FOREIGN_KEY_VIOLATION":
      return new DomainError(ERROR_CODES.VALIDATION_FAILED, "A referenced record does not exist", {
        cause: error,
      })
    case "CONNECTION_FAILED":
    case "TIMEOUT":
      return new DomainError(ERROR_CODES.SERVICE_UNAVAILABLE, "The database is unavailable", {
        cause: error,
      })
    default:
      return new DomainError(ERROR_CODES.DATABASE_ERROR, "A database error occurred", {
        cause: error,
      })
  }
}
