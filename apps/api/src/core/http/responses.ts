import type { ContentfulStatusCode } from "hono/utils/http-status"

import { ERROR_CODES, type ErrorCode } from "../errors"

/**
 * The error body shape, consumed by `ServerFormError` on the frontend.
 *
 * `{ error: { code, message, details } }` — `code` is stable, `message` is safe
 * to render, `details` drives per-field messages.
 */
export type ApiErrorBody = {
  error: {
    code: ErrorCode
    message: string
    details?: { field?: string; message: string }[]
  }
}

export function errorBody(
  code: ErrorCode,
  message: string,
  details?: { field?: string; message: string }[],
): ApiErrorBody {
  return details && details.length > 0
    ? { error: { code, message, details } }
    : { error: { code, message } }
}

/** Any failure the transport did not classify becomes this, with no internals. */
export function internalErrorBody(correlationId?: string): ApiErrorBody {
  return {
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Something went wrong. Please try again.",
      ...(correlationId ? { details: [{ message: `Reference: ${correlationId}` }] } : {}),
    },
  }
}

export function notFoundBody(): ApiErrorBody {
  return errorBody(ERROR_CODES.NOT_FOUND, "The requested resource was not found")
}

export function jsonError(
  code: ErrorCode,
  message: string,
  status: ContentfulStatusCode = 400,
  details?: { field?: string; message: string }[],
): Response {
  return Response.json(errorBody(code, message, details), { status })
}
