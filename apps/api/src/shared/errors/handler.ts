import { ERROR_CODES, isDomainError } from "../../core/errors"
import { internalErrorBody, notFoundBody, response } from "../../core/http/responses"
import type { AppEnv } from "../../types/env"
import type { Context, ErrorHandler, NotFoundHandler } from "hono"

/**
 * The single place errors become HTTP responses.
 *
 * `DomainError` keeps its `code` all the way to the client. Anything else is
 * logged in full and answered with a generic message plus the correlation id —
 * driver messages, stacks and SQL never reach a response body.
 */
export const onError: ErrorHandler<AppEnv> = (error, c) => {
  const requestId = c.get("requestId") ?? "-"

  if (isDomainError(error)) {
    if (error.status >= 500) {
      console.error("[error]", { code: error.code, message: error.message, cause: error.cause })
    } else {
      console.warn("[error]", { code: error.code, message: error.message })
    }

    return c.json(
      { ...response.error(error.code, error.message, error.details), status: error.status },
      error.status as 400,
    )
  }

  console.error("[error]", { error, requestId })

  return c.json(internalErrorBody(requestId), 500)
}

export const notFound: NotFoundHandler<AppEnv> = (c: Context<AppEnv>) => c.json(notFoundBody(), 404)

export { ERROR_CODES }
