import { bearerSecurity, errorResponse } from "./components"
import { jsonSchemaOf, pageSchema, type SchemaObject } from "./schema"
import {
  surfaceOperations,
  type OperationContract,
  type SurfaceOperation,
  type SurfaceSpec,
} from "../shared/auth/surface"

/**
 * OpenAPI generation from an operation surface.
 *
 * The hand-written `paths/*.openapi.ts` fragments existed because a Zod schema
 * can only describe a body, while an operation is more than a body: it has an id,
 * a mount point, a tag, prose, and a set of failure statuses. Those fragments
 * therefore restated the contract a second time, and `coverage.ts` existed purely
 * to catch the two copies drifting.
 *
 * A registry entry already *is* the contract, so there is nothing to restate and
 * nothing to check. What follows converts a registry entry into the subset of an
 * OpenAPI operation a schema cannot express, and reads every body and parameter
 * back out of the same Zod schema the route validates with — in `"input"` mode
 * for requests, `"output"` for responses, so a defaulted field is optional in a
 * query and guaranteed in a response.
 */

type SchemaProperty = SchemaObject

function jsonBody(schema: SchemaObject) {
  return { content: { "application/json": { schema } } }
}

/**
 * The success body, in the shape the registry declared it — or `null` when it
 * declared none.
 *
 * `null` is the case a `DELETE` needs. A 204 has no body, and by RFC 9110 it
 * *must not* have one, so a registry delete cannot return `{"deleted": true}` to
 * make the generator's job easy. This used to be a non-null assertion, which threw
 * while building the spec rather than at a point where the mistake was obvious.
 */
function successBody(operation: OperationContract): SchemaObject | null {
  if (operation.listNodes) return pageSchema(jsonSchemaOf(operation.listNodes, "output"))
  if (!operation.response) return null
  return jsonSchemaOf(operation.response, "output")
}

/** Query parameters, derived from the query schema so they cannot drift from it. */
function queryParameters(operation: OperationContract) {
  if (!operation.query) return []

  const schema = jsonSchemaOf(operation.query, "input")
  const required = (schema.required as string[] | undefined) ?? []
  const properties = (schema.properties as Record<string, SchemaProperty> | undefined) ?? {}

  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: "query",
    required: required.includes(name),
    schema: propertySchema,
  }))
}

/** Path parameters, derived from the params schema for the same reason. */
function pathParameters(operation: SurfaceOperation) {
  if (!operation.params) return []

  const schema = jsonSchemaOf(operation.params, "input")
  const properties = (schema.properties as Record<string, SchemaProperty> | undefined) ?? {}

  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: "path",
    // A path parameter is required by definition; the schema only tells us it exists.
    required: true,
    schema: propertySchema,
    ...(operation.paramDescriptions?.[name]
      ? { description: operation.paramDescriptions[name] }
      : {}),
  }))
}

function buildOperation(operation: SurfaceOperation) {
  const parameters = [...pathParameters(operation), ...queryParameters(operation)]

  const success = successBody(operation)
  const responses: Record<string, unknown> = {
    [operation.successStatus]: {
      description: operation.successDescription ?? operation.summary,
      ...(success ? jsonBody(success) : {}),
    },
  }

  // `normalizeSurface` already ordered these 2xx/401/403/ascending-extras.
  for (const [status, description] of Object.entries(operation.errors ?? {}).sort(
    ([a], [b]) => Number(a) - Number(b),
  )) {
    responses[status] = errorResponse(description)
  }

  return {
    operationId: operation.id,
    summary: operation.summary,
    ...(operation.description ? { description: operation.description } : {}),
    tags: [operation.tag],
    ...(operation.policy.public ? {} : { security: bearerSecurity }),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(operation.body
      ? { requestBody: { required: true, ...jsonBody(jsonSchemaOf(operation.body, "input")) } }
      : {}),
    responses,
  }
}

/** `/jobs/:id` (Hono, as routes are written) -> `/jobs/{id}` (OpenAPI). */
function toOpenApiPath(honoPath: string): string {
  return honoPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}")
}

/** The `paths` object a surface contributes, keyed by OpenAPI-style path. */
export function buildSurfacePaths(spec: SurfaceSpec): Record<string, Record<string, unknown>> {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const operation of surfaceOperations(spec)) {
    const path = toOpenApiPath(operation.mountedPath)
    const item = (paths[path] ??= {})
    item[operation.method.toLowerCase()] = buildOperation(operation)
  }

  return paths
}

/**
 * The `tags` array for a set of surfaces, one entry per distinct tag name.
 *
 * A feature can span surfaces — `parcels` is the admin surface's staff half and
 * the customer surface's self-service half — and a tag is a document-level
 * grouping, not a per-surface one. OpenAPI requires tag names to be unique, so
 * the first surface to claim a name would otherwise shadow the rest and Swagger
 * UI would render "parcels" twice.
 *
 * An explicit `tagDescription` always wins over the derived default, whichever
 * order the surfaces are passed in, so the shared tag reads as one description
 * covering both audiences rather than depending on registration order.
 */
export function buildSurfaceTags(...specs: SurfaceSpec[]) {
  const explicit = new Map<string, string>()
  const derived = new Map<string, string>()

  for (const spec of specs) {
    for (const [feature, contract] of Object.entries(spec.features)) {
      if (contract.tagDescription) {
        explicit.set(contract.tag, contract.tagDescription)
      } else if (!derived.has(contract.tag)) {
        derived.set(contract.tag, `Operations for ${feature.replace(/s$/, "")}.`)
      }
    }
  }

  // Derived names first so a surface without a description still gets a slot;
  // then the explicit ones, which take precedence on collision.
  return [...new Set([...derived.keys(), ...explicit.keys()])].map((name) => ({
    name,
    description: explicit.get(name) ?? derived.get(name)!,
  }))
}
