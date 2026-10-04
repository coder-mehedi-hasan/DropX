import type { SchemaObject } from "./schema"
import { refTo } from "./schema"

/**
 * Reusable OpenAPI components.
 *
 * Only genuinely cross-cutting shapes live here. Anything a single feature owns
 * stays in that feature's `*.dto.ts` and is referenced from its operations, so
 * this file does not grow into a second copy of the domain model.
 */

export const bearerSecurity = [{ bearerAuth: [] }]

export const securitySchemes: Record<string, unknown> = {
  bearerAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "Access token from a login or OTP exchange. Sent as `Authorization: Bearer <token>`; the audience is part of the token, so an admin token is rejected on rider and customer routes.",
  },
}

export const schemas: Record<string, SchemaObject> = {
  // Emitted by `buildPage` in @dropx/types; documented once so every list reuses it.
  PageMeta: {
    type: "object",
    required: ["totalCount", "currentPage", "totalPages", "hasNextPage", "hasPreviousPage"],
    properties: {
      totalCount: {
        type: "integer",
        description: "Rows matching the filters, ignoring the page window.",
      },
      currentPage: { type: "integer" },
      totalPages: { type: "integer" },
      hasNextPage: { type: "boolean" },
      hasPreviousPage: { type: "boolean" },
    },
  },
}

/** Response bodies every operation can return, keyed by status. */
export const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: refTo("ErrorResponse") } },
})
