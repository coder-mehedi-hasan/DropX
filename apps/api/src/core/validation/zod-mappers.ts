import { z } from "zod";

import { ERROR_CODES, DomainError, type ErrorDetail } from "../errors";

/**
 * Turns a Zod failure into the API's `{ field, message }` detail list so the
 * frontend can render both per-field errors and a top-of-form summary.
 */
export function zodErrorDetails(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => {
    const path = issue.path.map((segment) => String(segment)).join(".");
    return { ...(path ? { field: path } : {}), message: issue.message };
  });
}

export function zodFailure(error: z.ZodError): DomainError {
  return new DomainError(
    ERROR_CODES.VALIDATION_FAILED,
    "Some fields need attention",
    { details: zodErrorDetails(error) },
  );
}

export function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError;
}

/** Formats a field-level message list for a form-level summary. */
export function summariseDetails(details: ErrorDetail[]): string[] {
  return details.map((detail) => (detail.field ? `${detail.field}: ${detail.message}` : detail.message));
}
