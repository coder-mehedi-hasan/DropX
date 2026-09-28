import { z } from "zod"

import { ERROR_CODES } from "../core/errors"

/**
 * Zod -> OpenAPI 3.1 schema conversion.
 *
 * The API already validates every boundary with Zod and the DTOs already live
 * next to their routes, so the spec is generated from those same schemas rather
 * than hand-written. A hand-written spec is a second source of truth that drifts
 * the moment a DTO changes; this way the description of a field and the runtime
 * validation of that field cannot disagree.
 *
 * OpenAPI 3.1 is a superset of JSON Schema 2020-12, which is exactly what Zod 4
 * emits, so no lossy down-conversion is needed. The only edit is dropping the
 * `$schema` keyword, which OpenAPI forbids inside a schema object.
 *
 * `io` matters and is not cosmetic:
 *   - "input"  describes what a client may send. Defaults are *optional* here.
 *   - "output" describes what the server returns. Defaults are *required* here,
 *                  because the server always sends them.
 * A field defaulted with `.default(20)` is optional in a query and guaranteed in
 * a response, and only the two modes above get that right.
 */

export type SchemaObject = Record<string, unknown>

/** Convert a Zod schema to an OpenAPI 3.1 schema object. */
export function jsonSchemaOf(schema: z.ZodType, io: "input" | "output" = "input"): SchemaObject {
  const generated = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    // An unrepresentable check (a `.superRefine` rule, a transform) must not
    // silently produce a schema that claims less than the code enforces.
    unrepresentable: "any",
    // Cycles would otherwise recurse forever; the entities are acyclic today.
    cycles: "ref",
    reused: "inline",
  }) as SchemaObject

  // `$schema` is not a valid keyword in an OpenAPI Schema Object.
  delete generated.$schema
  return generated
}

/**
 * The JSON Schema for a single property of an object schema.
 *
 * Used where a DTO field is promoted to a standalone OpenAPI parameter (a path
 * param, a query param) and its shape should still come from the DTO rather than
 * being restated. Throws if the property is absent, so a renamed DTO field fails
 * loudly here instead of quietly dropping the parameter from the spec.
 */
export function propertySchemaOf(
  schema: z.ZodType,
  property: string,
  io: "input" | "output" = "input",
): SchemaObject {
  const properties = jsonSchemaOf(schema, io).properties
  const found = (properties as Record<string, SchemaObject> | undefined)?.[property]
  if (!found) {
    throw new Error(`Schema has no property "${property}" — was the DTO field renamed?`)
  }
  return found
}

/** A `{ $ref }` to a named component. */
export function refTo(name: string): SchemaObject {
  return { $ref: `#/components/schemas/${name}` }
}

/** Convenience: a component reference for a Zod schema, in the given io mode. */
export function refFor(schema: z.ZodType, name: string, io: "input" | "output" = "output") {
  return { name, schema: jsonSchemaOf(schema, io) }
}

/**
 * The `{ nodes, meta }` list envelope.
 *
 * Every list in the API returns this shape, so it is built from a single helper
 * and the `meta` half points at the shared `PageMeta` component rather than
 * inlining five identical objects per list endpoint.
 */
export function pageSchema(node: SchemaObject): SchemaObject {
  return {
    type: "object",
    required: ["nodes", "meta"],
    properties: {
      nodes: { type: "array", items: node },
      meta: refTo("PageMeta"),
    },
  }
}

const errorDetail = z.object({
  field: z.string().optional(),
  message: z.string(),
})

/**
 * The common response envelope emitted by both success and error paths.
 * Kept here as Zod so `code` cannot fall out of sync with `ERROR_CODES`.
 */
export const errorResponseSchema = z.object({
  error: z.string().nullable(),
  data: z.null(),
  status: z.number(),
  success: z.literal(false),
  code: z.enum(Object.values(ERROR_CODES)),
  details: z.array(errorDetail).optional(),
})

/** `{ ok: true }` — the shape of no-op acknowledgements like `POST /auth/logout`. */
export const okResponseSchema = z.object({ ok: z.literal(true) })
