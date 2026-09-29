import { getConfig } from "../config"
import { ADMIN_SURFACE } from "../modules/admin/registry"
import { CUSTOMER_SURFACE } from "../modules/customer/registry"
import { getPolicyCatalog, type CatalogEntry } from "../shared/auth/policy"
import { bearerSecurity, schemas as componentSchemas, securitySchemes } from "./components"
import { errorResponseSchema, jsonSchemaOf } from "./schema"

import { authPaths, authTags } from "./paths/auth.openapi"
import { healthPaths, healthTags } from "./paths/health.openapi"
import { jobsPaths, jobsTags } from "./paths/jobs.openapi"
import { pricingPaths, pricingTags } from "./paths/pricing.openapi"
import { trackingPaths, trackingTags } from "./paths/tracking.openapi"
import { buildSurfacePaths, buildSurfaceTags } from "./surface-spec"

/**
 * The OpenAPI document.
 *
 * Assembled from the hand-written `*.openapi.ts` fragments, the generated
 * fragment for each operation surface, and the live policy catalog. Request and
 * response schemas come from the same Zod DTOs the routes validate with, so the
 * published contract and the runtime contract are the same object.
 *
 * Two sources of paths coexist on purpose, and the difference is whether the
 * operation declares itself in a registry:
 *   - a surface (`admin`) generates its paths from the registry, so the spec and
 *     the policy catalog are the same object and cannot disagree;
 *   - a hand-written module (`auth`, `jobs`, …) still has a fragment, because it
 *     has no registry to read from. `coverage.ts` is the check for those.
 */

const paths = {
  ...healthPaths,
  ...authPaths,
  ...trackingPaths,
  ...buildSurfacePaths(ADMIN_SURFACE),
  ...buildSurfacePaths(CUSTOMER_SURFACE),
  ...jobsPaths,
  ...pricingPaths,
} as const

const tags = [
  ...healthTags,
  ...authTags,
  ...trackingTags,
  ...buildSurfaceTags(ADMIN_SURFACE, CUSTOMER_SURFACE),
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
        "Single-tenant parcel delivery & logistics API. All business routes are under `/api/v1`; health probes are additionally served unversioned. Responses use `{ error, data, status, success, code }`; error codes are stable and safe to branch on, and lists are always `{ nodes, meta }` inside `data`.",
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
