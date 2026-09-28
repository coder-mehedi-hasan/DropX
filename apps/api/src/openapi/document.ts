import { getConfig } from "../config"
import { getPolicyCatalog, type CatalogEntry } from "../shared/auth/policy"
import { bearerSecurity, schemas as componentSchemas, securitySchemes } from "./components"
import { errorResponseSchema, jsonSchemaOf } from "./schema"

import { authPaths, authTags } from "./paths/auth.openapi"
import { healthPaths, healthTags } from "./paths/health.openapi"
import { jobsPaths, jobsTags } from "./paths/jobs.openapi"
import { parcelsPaths, parcelsTags } from "./paths/parcels.openapi"
import { pricingPaths, pricingTags } from "./paths/pricing.openapi"
import { trackingPaths, trackingTags } from "./paths/tracking.openapi"

/**
 * The OpenAPI document.
 *
 * Assembled from the per-domain `*.openapi.ts` fragments plus the live policy
 * catalog. Request and response schemas come from the same Zod DTOs the routes
 * validate with, so the published contract and the runtime contract are the same
 * object. See `schema.ts` for why that matters and `coverage.ts` for the
 * guarantee that no operation is documented one way and enforced another.
 */

const paths = {
  ...healthPaths,
  ...authPaths,
  ...trackingPaths,
  ...parcelsPaths,
  ...jobsPaths,
  ...pricingPaths,
} as const

const tags = [
  ...healthTags,
  ...authTags,
  ...trackingTags,
  ...parcelsTags,
  ...jobsTags,
  ...pricingTags,
]

/** Every operation declared in the path fragments, flattened for the coverage check. */
export function specOperations(): { operationId: string; method: string; path: string }[] {
  const operations: { operationId: string; method: string; path: string }[] = []
  for (const [path, item] of Object.entries(paths)) {
    for (const method of ["get", "post", "patch", "put", "delete"] as const) {
      const operation = (item as Record<string, any>)[method]
      if (operation) operations.push({ operationId: operation.operationId, method, path })
    }
  }
  return operations
}

/**
 * The API origin, from the same `API_BASE_URL` the app is configured with — so
 * the docs' "try it" button hits the same process that serves the UI, in dev
 * and in production alike.
 */
function serverUrl(): string {
  return getConfig().baseUrl.replace(/\/+$/, "")
}

export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "DropX API",
      version: "1.0.0",
      description:
        "Single-tenant parcel delivery & logistics API. All business routes are under `/api/v1`; health probes are additionally served unversioned. Errors are always `{ error: { code, message, details? } }` where `code` is stable and safe to branch on, and lists are always `{ nodes, meta }`.",
    },
    servers: [{ url: `${serverUrl()}/api/v1`, description: "Business API (v1)" }],
    tags,
    security: bearerSecurity,
    components: {
      securitySchemes,
      schemas: {
        ErrorResponse: jsonSchemaOf(errorResponseSchema, "output"),
        ...componentSchemas,
      },
    },
    paths,
  } as const
}

export const openApiDocument = buildOpenApiDocument()

/** Catalog entries keyed by operation id, for the coverage check and diagnostics. */
export function catalogEntries(): CatalogEntry[] {
  return [...getPolicyCatalog().values()]
}
