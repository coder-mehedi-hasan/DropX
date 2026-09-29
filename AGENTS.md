# AGENTS.md

Guidance for AI agents working on **DropX**.

## What this project is

Single-tenant parcel delivery & logistics platform for one courier company. Full lifecycle: create → pickup → hub/transfer → last-mile delivery → COD/payments → settlements.

Canonical product docs:

- [`docs/overview.md`](docs/overview.md) — system overview, portals, login
- [`docs/rbac.md`](docs/rbac.md) — roles, permission keys, enforcement
- [`docs/er-diagram.md`](docs/er-diagram.md) — ER diagram
- [`docs/brand-guidelines.md`](docs/brand-guidelines.md) — brand system, logo asset matrix, accessibility, and production handoff
- [`docs/admin-plan.md`](docs/admin-plan.md) — admin/ops feature plan, the operation-surface system, and the phased build order
- [`migrate.sql`](migrate.sql) — MySQL schema (source of truth for DB)

Point-in-time session notes (stale by nature — delete once the open items are closed):

- [`docs/handoff.md`](docs/handoff.md) — last verification pass: four bugs found, `check:read-paths` added, outstanding gaps, suggested skills for the next session

## Monorepo layout

Bun workspace, TypeScript throughout, apps consume `packages/*` as source (no build step for packages).

```text
apps/
  web/       # Customer portal (OTP phone/email) — Next.js App Router
  riders/    # Rider app (email + password) — Vite, mobile-first
  admin/     # Admin / ops portal (email + password) — Vite
  api/       # Backend API for all clients — Hono, run by Bun
packages/
  db/        # Database port + MySQL adapter, entities, query builder, migrate runner
  ui/        # Shared design tokens and shadcn-style components on Radix
mprocs.yaml  # `bun run dev` runs api + admin + riders + web together
```

Brand assets and the interactive brand book live in:

```text
apps/web/
  public/brand/                         # approved SVG logos and imagery brief
  src/app/brand-guidelines/page.tsx     # public interactive guidelines route
docs/brand-guidelines.md                 # written brand contract and handoff checklist
```

| Workspace     | Audience         | Auth                                      | Dev port |
| ------------- | ---------------- | ----------------------------------------- | -------- |
| `apps/web`    | Customers        | OTP to phone or email — no password       | 3000     |
| `apps/riders` | Riders           | `users` email + password; row in `riders` | 5174     |
| `apps/admin`  | Staff            | `users` email + password + RBAC           | 5173     |
| `apps/api`    | All of the above | Auth, business logic, DB access           | 8000     |
| `packages/db` | —                | Database port/adapter, no app logic       | —        |
| `packages/ui` | —                | Tokens + components, no app logic         | —        |

**Do not** create separate portals for branches or hubs. Branch/hub staff use `apps/admin` with role + branch/hub scoping.

### Commands

| Command                                   | Does                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `bun run dev`                             | All four apps in parallel via `mprocs`                                  |
| `bun run typecheck`                       | `tsc --noEmit` across every workspace                                   |
| `bun run build`                           | Production build of every app                                           |
| `bun run lint`                            | Prettier check                                                          |
| `bun run db:migrate`                      | Apply `migrate.sql` (idempotent)                                        |
| `bun run db:reset`                        | Drop every table, then reapply                                          |
| `bun run db:seed`                         | Seed roles + their default permission grants                            |
| `bun run --cwd apps/api smoke`            | Boot the app; assert the policy catalog **and** OpenAPI coverage        |
| `bun run --cwd apps/api check:read-paths` | Run every read query against the real schema (needs `db:migrate` first) |

Server-side config (`DATABASE_URL`, `APP_SECRET`, `API_*`, `BOOTSTRAP_*`) lives in
`.env` at the repo root; the API and the scripts read it from there whatever
directory they run in. Each frontend loads its own URL from its own `.env`
(Next/Vite auto-load from the app directory) — see `apps/web/.env.example`,
`apps/admin/.env.example` and `apps/riders/.env.example`. Local overrides go in
`.env.local` per app (gitignored).

`smoke` needs no database — it asserts policy and auth wiring. `check:read-paths` is the complement: it executes every SELECT against a migrated database, which is how a query referencing a column that does not exist gets caught. An empty database is enough, since a bad column throws while a valid one simply returns no rows. Run both after touching SQL.

### API conventions

- Business routes are versioned under `/api/v1`. `/health` and `/health/ready` are also served unversioned for probes.
- Lists return `{ nodes, meta }`. Errors return `{ error: { code, message, details? } }`; `DomainError.code` survives to the client, and driver messages never do.
- **Every route declares its operation** through `defineOperation` in `apps/api/src/shared/auth/policy.ts`, which registers it in the catalog _and_ enforces it. A route that is missing from the catalog fails the `smoke` check rather than failing open.
- Modules are registered in one place: `apps/api/src/modules/index.ts`.

### Adding an operation — declare it once

There are two ways to add an operation. **Prefer a registry.** A registry entry _is_ the whole contract; nothing downstream restates any of it.

**1. In a registry (the current way for `admin` and `customer`)** — one entry in `modules/<surface>/registry/<feature>.ts`, plus one handler in `modules/<surface>/handlers.ts`:

```ts
export const ADMIN_SURFACE = defineSurface({
  namespace: "admin",
  basePath: "/admin",
  features: {
    parcels: {
      tag: "parcels",
      operations: {
        cancel: {
          method: "POST",
          path: "/parcels/:id/cancel",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PARCELS_CANCEL] },
          summary: "Cancel a parcel (staff)",
          successDescription: "Cancelled.",
          params: parcelIdParamSchema,
          body: cancelParcelSchema,
          response: parcelResponseSchema,
          errors: { 409: "The parcel cannot be cancelled from its current status." },
        },
      },
    },
  },
})
```

`mountSurface` derives the operation id (`admin.parcels.cancel`) and the mounted path (`/admin/parcels/:id/cancel`), registers the policy via `defineOperation`, mounts the handler behind it, and generates the OpenAPI operation. **You never write the id or the path twice, and there is no spec file to update.**

Three rules make this safe:

- **Registry and handlers must be a bijection.** A registry entry with no handler, or a handler with no registry entry, throws at boot naming both orphans. `smoke` exercises this.
- **`response` XOR `listNodes`.** A plain body, or a `{ nodes, meta }` page of that schema — not both, not neither.
- **Error precedence is operation → surface → built-in.** A surface-level `errors` block corrects the generic 401/403 text for every operation in it, which the customer surface needs: its 403 means "session not ACTIVE (OTP unverified)", not "missing a permission" — a customer holds no permission keys. An operation's own `errors` still wins.

A tag belongs to the document, not to a surface, and one feature can span two — `parcels` is staff and self-service. `buildSurfaceTags(ADMIN_SURFACE, CUSTOMER_SURFACE)` therefore takes every surface and emits one entry per distinct name, with an explicit `tagDescription` beating the derived default regardless of argument order. OpenAPI requires tag names to be unique; `smoke` asserts that, and that no tag is declared-but-unused or used-but-undeclared.

Mount the **relative** `path`; `registerModules` prefixes `basePath` when it calls `app.route()`. `defineOperation` and the spec get the absolute one. The registry derives both, so you only ever write the relative path.

**2. By hand (`auth`, `jobs`, `tracking`, `pricing`, `health`)** — still three things, checked against each other at boot. Skipping any one fails `smoke`:

1. **Route + policy** — `defineOperation(...)` in the module's `*.routes.ts`.
2. **DTOs** — request schemas _and_ response schemas in the module's `*.dto.ts`. Both live there because the published contract and the runtime validation must be the same object; a hand-written response body is a second source of truth that drifts.
3. **OpenAPI entry** — an operation in `openapi/paths/<domain>.openapi.ts`, describing only what the schema cannot: `operationId`, tag, summary, and status codes. **Do not restate fields** — bodies and parameters are pulled from the Zod DTOs via `jsonSchemaOf()`.

```text
apps/api/src/openapi/
  schema.ts          # Zod -> OpenAPI 3.1 conversion; pageSchema(); propertySchemaOf()
  components.ts      # only cross-cutting shapes: ErrorResponse, PageMeta, bearerAuth
  surface-spec.ts    # registry -> OpenAPI paths and tags
  paths/*.openapi.ts # one hand-written fragment per remaining domain, in document.ts
  document.ts        # assembles info/servers/tags/components + merges fragments and surfaces
  coverage.ts        # the catalog <-> spec guarantee for hand-written fragments only
  router.ts          # serves /openapi.json and /docs
```

Two details that are easy to get wrong:

- `jsonSchemaOf(schema, io)` takes an **io mode**. Requests use `"input"` (a field with `.default()` is optional); responses use `"output"` (the server always sends it, so it is required). The two are genuinely different documents. `surface-spec.ts` handles this for you.
- `document.ts` must import a new hand-written fragment, or it is silently absent — and `assertOpenApiCoverage()` will fail the boot with the operation id and the expected path.

**The drift guard, and its shrinking scope.** `coverage.ts` compares the policy catalog against the spec and throws at boot unless: every enforced operation is documented, every documented operation is enforced, `operationId` and method match, and the documented path matches the mounted path. This is the same fail-closed philosophy as `assertPolicyCatalog` — a route must not be able to ship enforced one way and documented another. Verified to fail on injected drift in both directions.

It now guards **only the hand-written fragments**: a registry operation is generated from the same object that registered its policy, so it is trivially consistent and the check says nothing useful about it. As each module moves to a registry this file's surface area shrinks; when the last one does, delete `coverage.ts` and `paths/`.

Operation ids are `{domain}.{action}`, or `{namespace}.{domain}.{action}` where the namespace is one of `OPERATION_NAMESPACES` in `policy.ts` — a closed list, because a prefix is only worth having if something can enumerate the surfaces and check them.

The spec is public and unversioned at **`/openapi.json`**, with Swagger UI at **`/docs`**. It contains shapes only, no secrets, so it needs no token; gate both at the edge if a deployment wants them private.

## Architecture rules

1. **Single tenant** — one company per deployment; no org_id multi-tenancy.
2. **Permission keys are static in code** — `apps/api/src/shared/auth/permissions.ts`; stored only as strings on `role_permissions (role_id, permission_key)`. No `permissions` table.
3. **Customers are not RBAC users** — consent → TEMP customer → OTP verify → ACTIVE; OTP codes live in **Redis/cache only**.
4. **Phone and email unique** on `customers`.
5. **No guest booking**; **public tracking** by tracking number is allowed without login.
6. **Parcels can be created by customers and staff**.
7. **Hub scope** — `user_hubs` links staff to hubs. Single-tenant, so the guard is `Scope` (`branchId` + `hubIds`), not an `org_id`.
8. **Riders are users** — `riders.user_id` → `users`; may also have admin roles.
9. **Transfer drivers are staff** (`transfers.driver_id` → `users`), not riders.
10. **Delivery retries** — multiple `deliveries` rows per parcel via `attempt_no`; only one attempt may be open at a time, enforced by the API.
11. **Pricing** — parcel stores `destination_zone_id`; fee uses destination zone rules and is always recomputed server-side.
12. **COD** — customer pays rider → remitted to company → company disburses via settlements; rider compensation (`compensation_type`) is separate.
13. **Parcels are the hub of the domain** — pickups, transfers, deliveries, payments, events hang off parcels.
14. **Schema changes** — update `migrate.sql` and keep `docs/er-diagram.md` in sync when tables/FKs change.
15. **RBAC / product changes** — update `docs/rbac.md` and `docs/overview.md`.
16. **The database is reached only through the port** — `apps/api` imports `@dropx/db` and never `mysql2`. SQL composes via the `QueryBuilder`; sort columns are allowlisted because they arrive from clients. The handle and the cache are process-wide: a **service** resolves them with `getDatabase()` / `getCache()`, a **repository** takes an `Executor` so a transaction can pass `tx`, and a **route** passes neither — it supplies business input only. Tests install a double with `setDatabase()` / `setCache()`.
17. **Audience and permission are separate axes** — a rider token holds `rider.jobs.*` and must never satisfy `parcels.*`; the admin and rider surfaces are separate modules, not one route with two audiences.
18. **Branding has a source-of-truth contract** — use the approved assets in `apps/web/public/brand/`; do not recreate or manually combine logos in app code. Material brand changes update the interactive page, asset README, and `docs/brand-guidelines.md` together. The web brand page is light-first; dark mode is a documented paired environment.

## Where to put work

| Change                                    | Put it in                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Customer UI / OTP login UX                | `apps/web`                                                                               |
| Rider jobs, location, proof UI            | `apps/riders`                                                                            |
| Admin/ops screens, branch/hub mgmt        | `apps/admin`                                                                             |
| Auth, permissions checks, domain APIs     | `apps/api`                                                                               |
| Shared components, design tokens          | `packages/ui`                                                                            |
| Brand guidelines, logos, marketing assets | `apps/web/public/brand`, `apps/web/src/app/brand-guidelines`, `docs/brand-guidelines.md` |
| DB port, entities, query composition      | `packages/db`                                                                            |
| Driver specifics (pool, TLS, errors)      | `packages/db/src/adapters`                                                               |
| Tables / indexes / FKs                    | `migrate.sql`                                                                            |
| Product / auth / RBAC docs                | `docs/`                                                                                  |

## Coding expectations

- Prefer small, focused diffs; match existing patterns in the app you touch.
- Enforce permission keys and customer/rider scoping in `apps/api`, not only in the UI.
- Do not invent multi-tenant org tables, a permissions catalog table, or extra apps for branch/hub.
- Keep customer auth OTP-based (Redis); do not add customer passwords or MySQL OTP tables unless product docs change.
- Do not allow guest parcel booking; do allow unauthenticated tracking by tracking number.
- For brand/UI changes, preserve the documented light/dark variants, visible focus states, status labels, responsive behavior, and approved logo usage rules.

## Quick domain map

- Org: `branches` → `hubs` → staff `users` (+ `user_hubs`)
- RBAC: `roles` → `user_roles`, `role_permissions`
- Customers: `customers` (TEMP/ACTIVE), `customer_addresses` (OTP portal; Redis for OTP)
- Network: `zones`, `pricing_rules`, `vehicles`, `routes`, `route_stops`
- Ops: `parcels` (+ `destination_zone_id`), `pickups`, `transfers`, `deliveries` (retries), `parcel_events`
- Money: `payments`, `settlements`
- Misc: `notifications`, `support_tickets`, `audit_logs`
