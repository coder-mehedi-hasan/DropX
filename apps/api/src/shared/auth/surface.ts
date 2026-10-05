import type { z } from "zod"
import { Hono, type Context } from "hono"

import { validateJson, validateParam, validateQuery } from "../../core"
import type { AppEnv } from "../../types/env"
import { defineOperation, OPERATION_NAMESPACES, type OperationPolicy } from "./policy"

/**
 * Operation surfaces.
 *
 * A surface is the one place a group of related operations is declared. Each
 * entry carries the operation's **whole contract** — method, mounted path, auth
 * policy, request schemas, response schema, and the prose the spec needs — and
 * everything else is derived from it:
 *
 *   - the operation id          `${namespace}.${feature}.${key}`
 *   - the mounted path          `${basePath}${path}`
 *   - the policy catalog entry  via `defineOperation`
 *   - the OpenAPI operation     via `openapi/surface-spec.ts`
 *
 * Nothing downstream restates any of it, so the catalog and the spec are
 * literally the same object rather than two things someone has to keep in sync.
 * The previous arrangement — a hand-written `*.openapi.ts` fragment checked
 * against the catalog by `coverage.ts` — could drift, and the check existed only
 * to catch it. Here the check is unnecessary because there is nothing to drift.
 *
 * What a registry **cannot** hold is behaviour: an entry can name the schema
 * that validates a body, but not `await parcels.createParcel(...)`. So each
 * feature is two files — this contract, and a handler keyed by the same string.
 * `mountSurface` asserts the two are a bijection, so an orphan on either side
 * fails the boot rather than shipping a route with no policy or a policy with
 * no route. That check is the whole reason this split is safe.
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

/**
 * The policy fields a registry entry supplies.
 *
 * `id` is omitted on purpose: a surface derives it from
 * `namespace` + feature + key, so writing one by hand would be a second place
 * for it to be wrong. `defineOperation` adds it back when it registers.
 */
export type SurfacePolicy = Omit<OperationPolicy, "id">

export type OperationContract = {
  method: HttpMethod
  /** Relative to the surface `basePath`. Hono style — `:id`, not `{id}`. */
  path: string
  policy: SurfacePolicy
  summary: string
  description?: string
  /** Request body schema. `c.req.valid("json")`. */
  body?: z.ZodType
  /** Query string schema. `c.req.valid("query")`. */
  query?: z.ZodType
  /** Path params object schema, e.g. `z.object({ id })`. `c.req.valid("param")`. */
  params?: z.ZodType
  /** Descriptions for the generated path parameters, keyed by param name. */
  paramDescriptions?: Record<string, string>
  /** Success body. Mutually exclusive with `listNodes`. */
  response?: z.ZodType
  /** Success body is a `{ nodes, meta }` page of this schema. */
  listNodes?: z.ZodType
  /** Defaults to 200; use 201 for a create. */
  successStatus?: number
  /** Prose for the success response body. Defaults to the summary. */
  successDescription?: string
  /** Extra error responses by status, e.g. `{ 409: "Cannot cancel a delivered parcel." }`. */
  errors?: Record<number, string>
}

export type FeatureContract = {
  /** OpenAPI tag for every operation in this feature. */
  tag: string
  /** Prose for the tag group in `/docs`. */
  tagDescription?: string
  operations: Record<string, OperationContract>
}

export type SurfaceSpec = {
  /** Id prefix, e.g. `admin` -> `admin.parcel.list`. Must be a known namespace. */
  namespace: string
  /** Mount prefix, e.g. `/admin` -> `/api/v1/admin`. */
  basePath: string
  /**
   * Error responses every operation in this surface shares, keyed by status.
   *
   * Worth declaring when a surface has its own vocabulary: a customer surface's
   * 403 means "session not ACTIVE (OTP unverified)", not "missing a permission" —
   * customers hold no permissions at all. An operation's own `errors` wins, so a
   * one-off 404 or 409 still reads next to the operation it belongs to.
   */
  errors?: Record<number, string>
  features: Record<string, FeatureContract>
}

/** A context whose validated targets are typed from the registry's Zod schemas. */
export type SurfaceContext<B = never, Q = never, P = never> = Omit<Context<AppEnv>, "req"> & {
  req: Context<AppEnv>["req"] & {
    valid(target: "json"): B
    valid(target: "query"): Q
    valid(target: "param"): P
  }
}

type InferOrNever<T> = T extends z.ZodType ? z.infer<T> : never

type FeatureHandlers<F extends FeatureContract> = {
  [K in keyof F["operations"]]: (
    c: SurfaceContext<
      InferOrNever<F["operations"][K]["body"]>,
      InferOrNever<F["operations"][K]["query"]>,
      InferOrNever<F["operations"][K]["params"]>
    >,
  ) => Response | Promise<Response>
}

/** The handler map, nested to mirror the registry so the join key is obvious. */
export type SurfaceHandlers<Spec extends SurfaceSpec> = {
  [F in keyof Spec["features"]]: FeatureHandlers<Spec["features"][F]>
}

/** A registry entry with its derived id and mounted path resolved. */
export type SurfaceOperation = OperationContract & {
  /** `${namespace}.${feature}.${key}`. */
  id: string
  key: string
  feature: string
  /**
   * `${basePath}${path}` — what the operation is actually reachable at, and what
   * the policy catalog and the spec must both say. Distinct from `path`, which
   * stays relative because `app.route()` composes the prefix itself; mounting on
   * the absolute path would apply `basePath` twice.
   */
  mountedPath: string
  tag: string
  successStatus: number
}

/** Identity at the type level; the real work happens in `normalizeSurface`. */
export function defineSurface<Spec extends SurfaceSpec>(spec: Spec): Spec {
  return spec
}

const NAMESPACES = new Set<string>(OPERATION_NAMESPACES)

/**
 * Fail-fast defaults every operation shares, so a registry entry stays about
 * what is *specific* to the operation rather than restating 401 on all of them.
 * An entry that supplies its own 401/403 overrides these.
 */
const DEFAULT_ERRORS = {
  401: "Not authenticated, or the token is missing/expired.",
  403: "Missing a required permission, or outside the caller's branch/hub scope.",
} as const

function normalizeSurface(spec: SurfaceSpec): {
  namespace: string
  basePath: string
  operations: SurfaceOperation[]
} {
  const surfaceErrors = spec.errors ?? {}
  if (!NAMESPACES.has(spec.namespace)) {
    throw new Error(
      `Surface namespace "${spec.namespace}" is not one of: ${[...NAMESPACES].join(", ")}`,
    )
  }
  if (!spec.basePath.startsWith("/")) {
    throw new Error(`Surface basePath "${spec.basePath}" must start with "/"`)
  }

  const operations: SurfaceOperation[] = []
  const seen = new Map<string, string>()

  for (const [feature, contract] of Object.entries(spec.features)) {
    for (const [key, operation] of Object.entries(contract.operations)) {
      const id = `${spec.namespace}.${feature}.${key}`

      if (seen.has(id)) {
        throw new Error(`Duplicate operation id "${id}" (${seen.get(id)} and ${feature}.${key})`)
      }
      seen.set(id, `${feature}.${key}`)

      const successStatus = operation.successStatus ?? 200

      const hasResponse = operation.response !== undefined
      const hasList = operation.listNodes !== undefined
      // "Exactly one" is the rule, with one deliberate exception: a 204 carries no
      // body, and by RFC 9110 it must not, so a `DELETE` cannot describe one. The
      // status is what makes the absence intentional — loosening this to "at most
      // one" would let a 200 with no declared body through, which is a contract
      // nobody can implement.
      const bodyless = successStatus === 204
      if (hasResponse === hasList && !(bodyless && !hasResponse && !hasList)) {
        throw new Error(
          `Operation "${id}" must declare exactly one of \`response\` or \`listNodes\`, not ${
            hasResponse ? "both" : "neither"
          }${bodyless ? " — a 204 is the only status that may declare neither" : ""}`,
        )
      }

      const errors: Record<number, string> = {}

      // Precedence, highest first:
      //   1. the operation's own `errors` — a one-off 404/409 belongs beside it
      //   2. the surface's `errors` — the vocabulary every operation shares
      //   3. the built-in defaults below
      // Read in that order so an explicit 403 beats a surface one and a surface
      // one beats the generic text, which is what lets the customer surface
      // correct the built-in "missing a permission" for a caller who holds none.
      for (const [status, description] of Object.entries(operation.errors ?? {})) {
        const code = Number(status)
        if (code === successStatus) {
          throw new Error(
            `Operation "${id}" lists status ${code} as an error but uses it for success`,
          )
        }
        errors[code] = description
      }
      for (const [status, description] of Object.entries(surfaceErrors)) {
        const code = Number(status)
        if (code !== successStatus) errors[code] ??= description
      }

      // Built-in defaults, only for a status nothing above claimed. Applied last
      // so a generated response object still reads 200/401/403 then ascending
      // extras, which is the order the spec fragments used to list.
      if (!operation.policy.public && errors[401] === undefined) {
        errors[401] = DEFAULT_ERRORS[401]
      }
      if (
        (operation.policy.permissions?.length || operation.policy.audience?.length) &&
        errors[403] === undefined
      ) {
        errors[403] = DEFAULT_ERRORS[403]
      }

      operations.push({
        ...operation,
        id,
        key,
        feature,
        tag: contract.tag,
        mountedPath: `${spec.basePath}${operation.path}`,
        successStatus,
        errors,
      })
    }
  }

  return { namespace: spec.namespace, basePath: spec.basePath, operations }
}

/** Every operation in a surface, with ids and paths resolved. */
export function surfaceOperations(spec: SurfaceSpec): SurfaceOperation[] {
  return normalizeSurface(spec).operations
}

/** `"parcels.cancel"` — the key a handler is registered under. */
export function handlerKey(feature: string, key: string): string {
  return `${feature}.${key}`
}

/**
 * Wires a surface: asserts registry/handler parity, registers the policy, and
 * mounts the handler behind it.
 *
 * Order matters and is the whole point — the policy is registered *from the
 * registry entry* and the handler is mounted *behind* that middleware, so an
 * operation cannot exist without enforcement.
 */
export function mountSurface<Spec extends SurfaceSpec>(
  router: Hono<AppEnv>,
  spec: Spec,
  handlers: SurfaceHandlers<Spec>,
): void {
  const { operations } = normalizeSurface(spec)

  const declared = new Set(operations.map((op) => handlerKey(op.feature, op.key)))
  const implemented = new Set<string>()
  for (const [feature, featureHandlers] of Object.entries(handlers)) {
    for (const key of Object.keys(featureHandlers)) implemented.add(handlerKey(feature, key))
  }

  const missingHandlers = [...declared].filter((key) => !implemented.has(key)).sort()
  const orphanHandlers = [...implemented].filter((key) => !declared.has(key)).sort()

  if (missingHandlers.length > 0 || orphanHandlers.length > 0) {
    const problems: string[] = []
    if (missingHandlers.length > 0) {
      problems.push(`registry entries with no handler: ${missingHandlers.join(", ")}`)
    }
    if (orphanHandlers.length > 0) {
      problems.push(`handlers with no registry entry: ${orphanHandlers.join(", ")}`)
    }
    throw new Error(
      `Surface "${spec.namespace}" registry and handlers disagree — ${problems.join("; ")}`,
    )
  }

  for (const operation of operations) {
    const handler = handlers[operation.feature as keyof Spec["features"]][
      operation.key as keyof (typeof handlers)[keyof Spec["features"]]
    ] as (c: SurfaceContext) => Response | Promise<Response>

    // Policy first, then params/query/body — the same order the hand-written
    // routers use. It decides an error code: with a malformed body and no token,
    // policy-first answers 401 and validators-first answers 422, and auth is the
    // more truthful of the two. `defineOperation` also records the catalog entry,
    // so running it first means an unauthenticated probe cannot register an
    // operation it was never allowed to reach.
    const middleware = [
      defineOperation(
        { id: operation.id, ...operation.policy },
        {
          method: operation.method,
          path: operation.mountedPath,
        },
      ),
      operation.params ? validateParam(operation.params) : null,
      operation.query ? validateQuery(operation.query) : null,
      operation.body ? validateJson(operation.body) : null,
    ].filter((m): m is NonNullable<typeof m> => m !== null)

    const mount = router[operation.method.toLowerCase() as "get"] as (
      path: string,
      ...handlers: unknown[]
    ) => void

    // Mounted on the relative path: `registerModules` prefixes `basePath` when
    // it calls `app.route()`.
    mount.call(router, operation.path, ...middleware, handler)
  }
}
