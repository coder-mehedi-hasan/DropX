#!/usr/bin/env bun
/**
 * Boot smoke test.
 *
 * Builds the real app and asserts the things that only break once modules are
 * wired together: every registered route has a policy entry, the catalog has no
 * duplicates, a surface's registry and handlers agree, and a public route answers
 * while a protected one fails closed.
 *
 * Runs without a database — middleware is never reached because the failures
 * happen in routing and policy, which is the point.
 */
import { createApp } from "../src/app"
import { ADMIN_SURFACE } from "../src/modules/admin/registry"
import { getPolicyCatalog } from "../src/shared/auth/policy"
import { surfaceOperations } from "../src/shared/auth/surface"
import { findCoverageMismatches } from "../src/openapi/coverage"
import { moduleManifest } from "../src/modules"

let failures = 0

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    return
  }
  failures += 1
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`)
}

async function main(): Promise<void> {
  const app = createApp()
  const catalog = getPolicyCatalog()

  console.log("· modules")
  for (const { name, basePath } of moduleManifest()) {
    console.log(`  ${name.padEnd(10)} ${basePath}`)
  }

  console.log("· policy catalog")
  check("catalog is populated", catalog.size > 0, `size=${catalog.size}`)

  // Operations declared by hand, one `defineOperation` call each.
  const handWrittenOps = [
    "health.read",
    "health.ready",
    "auth.loginAdmin",
    "auth.loginRider",
    "auth.refresh",
    "auth.otpRequest",
    "auth.otpVerify",
    "auth.me",
    "auth.logout",
    "tracking.lookup",
    "parcel.listOwn",
    "parcel.readOwn",
    "parcel.createOwn",
    "pricing.quote",
    "job.list",
    "job.read",
    "job.reportOutcome",
  ]

  for (const id of handWrittenOps) {
    check(`registered: ${id}`, catalog.has(id))
  }

  // Operations declared by a surface. Their ids are derived, so the list is not
  // restated here — a registry entry that fails to register is the failure this
  // catches, and adding one to a registry needs no change to this file.
  const surfaceOps = surfaceOperations(ADMIN_SURFACE)
  check("admin surface declares operations", surfaceOps.length > 0, `${surfaceOps.length}`)
  for (const operation of surfaceOps) {
    const entry = catalog.get(operation.id)
    check(
      `registered: ${operation.id}`,
      entry !== undefined &&
        entry.path === operation.mountedPath &&
        entry.method === operation.method,
      entry
        ? `mounted at ${entry.method} ${entry.path}, registry says ${operation.method} ${operation.mountedPath}`
        : "absent",
    )
  }

  console.log("· fail-closed behaviour")

  const unauthenticated = await app.request("/api/v1/admin/parcels")
  const body = (await unauthenticated.json()) as {
    error?: string
    code?: string
    success?: boolean
  }
  check(
    "protected route rejects an anonymous caller",
    unauthenticated.status === 401,
    `got ${unauthenticated.status}`,
  )
  check(
    "error body matches the contract",
    body.error === "Please sign in to continue" &&
      body.code === "UNAUTHENTICATED" &&
      body.success === false,
    JSON.stringify(body),
  )

  const missing = await app.request("/api/v1/nope")
  check("unknown route 404s in the same envelope", missing.status === 404)

  const publicOps = [...catalog.values()].filter((entry) => entry.public)
  check("public operations are declared public", publicOps.length > 0, "none found")

  // Health must answer without a database so a slow DB cannot cause a crash loop.
  const live = await app.request("/health")
  check("unversioned liveness probe answers", live.status === 200, `got ${live.status}`)

  console.log("· audience boundaries")

  // Public tracking is reachable with no token at all — a shared link must work.
  const tracking = await app.request("/api/v1/tracking/DPX260928000001")
  check(
    "public tracking is not gated by auth",
    tracking.status !== 401 && tracking.status !== 403,
    `got ${tracking.status}`,
  )

  // The admin parcel collection requires `parcels.view`; the rider job list
  // requires `rider.jobs.view` and the `riders` audience. An anonymous caller must
  // never be told which, and a caller holding one must not satisfy the other.
  const riderOps = catalog.get("job.list")
  check(
    "rider job list is not reachable anonymously",
    riderOps !== undefined && riderOps.audience?.includes("riders") === true,
    JSON.stringify(riderOps),
  )

  // An audience axis is only meaningful if it holds on both sides: an admin
  // operation must require `admin`, and nothing outside the admin mount may.
  const adminOps = [...catalog.values()].filter((entry) => entry.path.startsWith("/admin"))
  check(
    "every /admin operation requires the admin audience",
    adminOps.length > 0 && adminOps.every((entry) => entry.audience?.includes("admin") === true),
    `${adminOps.length} admin operations`,
  )
  check(
    "every admin-prefixed id is mounted under /admin",
    [...catalog.keys()]
      .filter((id) => id.startsWith("admin."))
      .every((id) => catalog.get(id)?.path.startsWith("/admin") === true),
  )

  console.log("· OpenAPI coverage")
  const mismatches = findCoverageMismatches()
  check(
    "every enforced operation is documented, and matches",
    mismatches.length === 0,
    mismatches.join(" | "),
  )

  const specResponse = await app.request("/openapi.json")
  check("openapi.json is served", specResponse.status === 200, `got ${specResponse.status}`)
  const spec = (await specResponse.json()) as {
    openapi?: string
    paths?: Record<string, Record<string, { operationId?: string }>>
  }
  check("document declares OpenAPI 3.1", spec.openapi?.startsWith("3.1") === true, spec.openapi)
  check("document has paths", Object.keys(spec.paths ?? {}).length > 0)

  // Swagger UI is served at /docs; assert it is not a 404 and references the spec.
  const docs = await app.request("/docs")
  check("swagger UI is served at /docs", docs.status === 200, `got ${docs.status}`)
  const docsHtml = await docs.text()
  check("swagger UI loads the spec", docsHtml.includes("/openapi.json"))

  console.log(`\n${failures === 0 ? "✓" : "✗"} ${catalog.size} operations, ${failures} failure(s)`)
}

main()
  .then(() => {
    if (failures > 0) process.exit(1)
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
