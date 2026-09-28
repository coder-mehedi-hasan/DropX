import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

import { ERROR_CODES, DomainError, type ErrorDetail } from "../errors"
import { zodErrorDetails } from "./zod-mappers"

/**
 * Boundary validation.
 *
 * Every body, path param, query and header is parsed here. On failure the hook
 * throws a `DomainError` carrying `VALIDATION_FAILED` plus per-field details —
 * the shape `ServerFormError` consumes. Hono's built-in failure body is not
 * used because it does not match the API error contract.
 */

type Infer<T extends z.ZodType> = z.infer<T>

type Target = "json" | "query" | "param" | "header"

/**
 * The single failure hook.
 *
 * `zValidator`'s `Hook` type is generic over the target it is mounted on, so one
 * function cannot be typed for all four call sites. The cast is confined to this
 * boundary; the signature we care about — the returned `DomainError` — is
 * enforced by the body below.
 */
function failOn(_target: Target) {
  return ((result: { success: boolean; error?: z.ZodError }) => {
    if (result.success) return
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "Some fields need attention", {
      details: zodErrorDetails(result.error ?? new z.ZodError([])),
    })
  }) as never
}

export function validateJson<T extends z.ZodType>(schema: T) {
  return zValidator("json", schema, failOn("json"))
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return zValidator("query", schema, failOn("query"))
}

export function validateParam<T extends z.ZodType>(schema: T) {
  return zValidator("param", schema, failOn("param"))
}

export function validateHeader<T extends z.ZodType>(schema: T) {
  return zValidator("header", schema, failOn("header"))
}

/** Parses outside a route — for values a service needs to trust. */
export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): Infer<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "Some fields need attention", {
      details: zodErrorDetails(result.error),
    })
  }
  return result.data
}

export type { Infer }
export { zodErrorDetails, zodFailure, isZodError, summariseDetails } from "./zod-mappers"
export type { ErrorDetail }
