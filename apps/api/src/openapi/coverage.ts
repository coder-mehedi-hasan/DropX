import { getPolicyCatalog } from "../shared/auth/policy"
import { specOperations } from "./document"

/**
 * Documentation/enforcement coverage.
 *
 * `defineOperation` is the single source of truth for which operations exist and
 * what they require; the `*.openapi.ts` fragments are the single source of truth
 * for how they are described. Neither is derived from the other, so this check
 * exists to stop them drifting apart — the failure mode being a route that is
 * enforced one way and documented another.
 *
 * Three properties are checked, each of which has actually caught something:
 *   1. every enforced operation is documented, and vice versa (no orphan either way)
 *   2. a documented operation's id and method match the catalog's, so `operationId`
 *      is a real join key and the UI's "authorize" is not a lie
 *   3. the documented path matches the mounted path, so a renamed route does not
 *      leave a spec entry pointing at a URL that 404s
 *
 * This is a boot assertion, not a test-only helper: a missing entry fails the
 * process at startup, exactly like `assertPolicyCatalog`, rather than shipping
 * a quietly incomplete spec.
 */

type Mismatch = string[]

/** `/jobs/:id` (Hono style, as routes are written) -> `/jobs/{id}` (OpenAPI style). */
function toOpenApiPath(honoPath: string): string {
  return honoPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}")
}

export function findCoverageMismatches(): Mismatch {
  const problems: Mismatch = []

  const catalog = getPolicyCatalog()
  const documented = specOperations()
  const documentedById = new Map(documented.map((op) => [op.operationId, op]))

  // 1 + 2: every catalog operation has a spec entry with the same id and method.
  for (const entry of catalog.values()) {
    const op = documentedById.get(entry.id)
    if (!op) {
      problems.push(`operation "${entry.id}" is enforced but not documented`)
      continue
    }
    if (op.method !== entry.method.toLowerCase()) {
      problems.push(
        `operation "${entry.id}" is ${entry.method} in the catalog but ${op.method.toUpperCase()} in the spec`,
      )
    }
  }

  // 1 (other direction): no spec entry without a catalog entry, i.e. the fragment
  // does not advertise something the router would never serve.
  for (const op of documented) {
    if (!catalog.has(op.operationId)) {
      problems.push(`operation "${op.operationId}" is documented but not enforced`)
    }
  }

  // 3: documented path matches the catalog's mounted path.
  for (const entry of catalog.values()) {
    const op = documentedById.get(entry.id)
    if (!op) continue
    const expected = toOpenApiPath(entry.path)
    if (op.path !== expected) {
      problems.push(
        `operation "${entry.id}" is mounted at "${entry.path}" but documented at "${op.path}" (expected "${expected}")`,
      )
    }
  }

  return problems
}

/**
 * Boot-time guard. Throws on the first mismatch so a spec that does not match
 * the enforced surface never gets served.
 */
export function assertOpenApiCoverage(): void {
  const problems = findCoverageMismatches()
  if (problems.length > 0) {
    throw new Error(
      `OpenAPI coverage is out of date with the policy catalog:\n  - ${problems.join("\n  - ")}\n` +
        `Add or fix an entry in apps/api/src/openapi/paths/*.openapi.ts.`,
    )
  }
}
