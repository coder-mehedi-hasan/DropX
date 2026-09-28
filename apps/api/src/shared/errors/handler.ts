import { getConfig } from "../../config"
import { ERROR_CODES, isDomainError } from "../../core/errors"
import { internalErrorBody, notFoundBody } from "../../core/http/responses"
import { createLogger, type Logger } from "../../core/logger"
import type { AppEnv } from "../../types/env"
import type { Context, ErrorHandler, NotFoundHandler } from "hono"

/**
 * `onError` also handles failures from `requestContext` itself, so the per-request
 * logger may not exist yet. Falling back to a standalone one keeps a broken
 * request from turning into an unhandled TypeError inside the error handler.
 */
let fallbackLogger: Logger | undefined

function loggerFor(c: Context<AppEnv>): Logger {
  return (
    c.get("logger") ??
    (fallbackLogger ??= createLogger(getConfig().logLevel, { scope: "error-handler" }))
  )
}

/**
 * The single place errors become HTTP responses.
 *
 * `DomainError` keeps its `code` all the way to the client. Anything else is
 * logged in full and answered with a generic message plus the correlation id —
 * driver messages, stacks and SQL never reach a response body.
 */
export const onError: ErrorHandler<AppEnv> = (error, c) => {
  const logger = loggerFor(c)
  const requestId = c.get("requestId") ?? "-"

  if (isDomainError(error)) {
    if (error.status >= 500) {
      logger.error("domain failure", {
        code: error.code,
        message: error.message,
        cause: error.cause,
      })
    } else {
      logger.warn("domain rejection", { code: error.code, message: error.message })
    }

    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      error.status as 400,
    )
  }

  logger.error("unhandled error", { error, requestId })

  return c.json(internalErrorBody(requestId), 500)
}

export const notFound: NotFoundHandler<AppEnv> = (c: Context<AppEnv>) => c.json(notFoundBody(), 404)

export { ERROR_CODES }
