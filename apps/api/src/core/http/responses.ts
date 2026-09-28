import type { ContentfulStatusCode } from "hono/utils/http-status"

import { ERROR_CODES, ERROR_STATUS, type ErrorCode } from "../errors"

/**
 * One response envelope for all API operations. `code` is stable and safe to
 * branch on, while `error` is a user-facing message and `details` drives
 * per-field validation messages when present.
 */
export type ApiResponse<T = unknown> = {
  error: string | null
  data: T | null
  status: number
  success: boolean
  code: string
  details?: { field?: string; message: string }[]
}

export type ApiErrorBody = ApiResponse<null>

const SUCCESS_CODES: Record<number, string> = {
  200: "OK",
  201: "CREATED",
  202: "ACCEPTED",
  204: "NO_CONTENT",
}

export function responseBody<T>(
  data: T,
  status: ContentfulStatusCode = 200,
  code = SUCCESS_CODES[status] ?? "OK",
): ApiResponse<T> {
  return { error: null, data, status, success: true, code }
}

/** Public transport helpers: `response.success(data)` / `response.error(...)`. */
export const response = {
  success: responseBody,
  error: errorBody,
}

export function errorBody(
  code: ErrorCode,
  message: string,
  details?: { field?: string; message: string }[],
): ApiErrorBody {
  return {
    error: message,
    data: null,
    status: ERROR_STATUS[code],
    success: false,
    code,
    ...(details && details.length > 0 ? { details } : {}),
  }
}

/** Any failure the transport did not classify becomes this, with no internals. */
export function internalErrorBody(correlationId?: string): ApiErrorBody {
  return {
    error: "Something went wrong. Please try again.",
    data: null,
    status: 500,
    success: false,
    code: ERROR_CODES.INTERNAL_ERROR,
    ...(correlationId ? { details: [{ message: `Reference: ${correlationId}` }] } : {}),
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
  return Response.json({ ...errorBody(code, message, details), status }, { status })
}
