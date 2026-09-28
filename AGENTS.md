# AGENTS.md

Guidance for AI agents working on **DropX**.

## What this project is

Single-tenant parcel delivery & logistics platform for one courier company. Full lifecycle: create → pickup → hub/transfer → last-mile delivery → COD/payments → settlements.

Canonical product docs:

- [`docs/overview.md`](docs/overview.md) — system overview, portals, login
- [`docs/rbac.md`](docs/rbac.md) — roles, permission keys, enforcement
- [`docs/er-diagram.md`](docs/er-diagram.md) — ER diagram
- [`migrate.sql`](migrate.sql) — MySQL schema (source of truth for DB)

Point-in-time session notes (stale by nature — delete once the open items are closed):

- [`docs/handoff.md`](docs/handoff.md) — last verification pass: four bugs found, `check:read-paths` added, outstanding gaps, suggested skills for the next session

## Monorepo layout

Bun workspace, TypeScript throughout, apps consume `packages/*` as source (no build step for packages).

```text
apps/
  web/       # Customer portal (OTP phone/email) — Next.js App Router
  riders/    # Rider app (email + password) — Vite, mobile-first
  console/   # Admin / ops console (email + password) — Vite
  api/       # Backend API for all clients — Hono, run by Bun
packages/
  db/        # Database port + MySQL adapter, entities, query builder, migrate runner
  ui/        # Shared design tokens and shadcn-style components on Radix
mprocs.yaml  # `bun run dev` runs api + console + riders + web together
```

| Workspace      | Audience         | Auth                                      | Dev port |
| -------------- | ---------------- | ----------------------------------------- | -------- |
| `apps/web`     | Customers        | OTP to phone or email — no password       | 3000     |
| `apps/riders`  | Riders           | `users` email + password; row in `riders` | 3003     |
| `apps/console` | Staff            | `users` email + password + RBAC           | 3002     |
| `apps/api`     | All of the above | Auth, business logic, DB access           | 3001     |
| `packages/db`  | —                | Database port/adapter, no app logic       | —        |
| `packages/ui`  | —                | Tokens + components, no app logic         | —        |

**Do not** create separate portals for branches or hubs. Branch/hub staff use `apps/console` with role + branch/hub scoping.

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
| `bun run --cwd apps/api smoke`            | Boot the app and assert the policy catalog                              |
| `bun run --cwd apps/api check:read-paths` | Run every read query against the real schema (needs `db:migrate` first) |

`.env` at the repo root is the single source of runtime configuration; the API and the scripts read it from there whatever directory they run in.

`smoke` needs no database — it asserts policy and auth wiring. `check:read-paths` is the complement: it executes every SELECT against a migrated database, which is how a query referencing a column that does not exist gets caught. An empty database is enough, since a bad column throws while a valid one simply returns no rows. Run both after touching SQL.

### API conventions

- Business routes are versioned under `/api/v1`. `/health` and `/health/ready` are also served unversioned for probes.
- Lists return `{ nodes, meta }`. Errors return `{ error: { code, message, details? } }`; `DomainError.code` survives to the client, and driver messages never do.
- **Every route declares its operation** through `defineOperation` in `apps/api/src/shared/auth/policy.ts`, which registers it in the catalog _and_ enforces it. A route that is missing from the catalog fails the `smoke` check rather than failing open.
- Modules are registered in one place: `apps/api/src/modules/index.ts`.

## Architecture rules

1. **Single tenant** — one company per deployment; no org_id multi-tenancy.
2. **Permission keys are static in code** — `apps/api/src/shared/auth/permissions.ts`; stored only as strings on `role_permissions (role_id, permission_key)`. No `permissions` table.
3. **Customers are not RBAC users** — consent → TEMP customer → OTP verify → ACTIVE; OTP codes live in **Redis/cache only**.
4. **Phone and email unique** on `customers`.
5. **No guest booking**; **public tracking** by tracking number is allowed without login.
6. **Parcels can be created by customers and staff**.
7. **Hub scope** — `user_hubs` links staff to hubs. Single-tenant, so the guard is `Scope` (`branchId` + `hubIds`), not an `org_id`.
8. **Riders are users** — `riders.user_id` → `users`; may also have console roles.
9. **Transfer drivers are staff** (`transfers.driver_id` → `users`), not riders.
10. **Delivery retries** — multiple `deliveries` rows per parcel via `attempt_no`; only one attempt may be open at a time, enforced by the API.
11. **Pricing** — parcel stores `destination_zone_id`; fee uses destination zone rules and is always recomputed server-side.
12. **COD** — customer pays rider → remitted to company → company disburses via settlements; rider compensation (`compensation_type`) is separate.
13. **Parcels are the hub of the domain** — pickups, transfers, deliveries, payments, events hang off parcels.
14. **Schema changes** — update `migrate.sql` and keep `docs/er-diagram.md` in sync when tables/FKs change.
15. **RBAC / product changes** — update `docs/rbac.md` and `docs/overview.md`.
16. **The database is reached only through the port** — `apps/api` imports `@dropx/db` and never `mysql2`. SQL composes via the `QueryBuilder`; sort columns are allowlisted because they arrive from clients.
17. **Audience and permission are separate axes** — a rider token holds `rider.jobs.*` and must never satisfy `parcels.*`; the console and rider surfaces are separate modules, not one route with two audiences.

## Where to put work

| Change                                | Put it in                  |
| ------------------------------------- | -------------------------- |
| Customer UI / OTP login UX            | `apps/web`                 |
| Rider jobs, location, proof UI        | `apps/riders`              |
| Admin/ops screens, branch/hub mgmt    | `apps/console`             |
| Auth, permissions checks, domain APIs | `apps/api`                 |
| Shared components, design tokens      | `packages/ui`              |
| DB port, entities, query composition  | `packages/db`              |
| Driver specifics (pool, TLS, errors)  | `packages/db/src/adapters` |
| Tables / indexes / FKs                | `migrate.sql`              |
| Product / auth / RBAC docs            | `docs/`                    |

## Coding expectations

- Prefer small, focused diffs; match existing patterns in the app you touch.
- Enforce permission keys and customer/rider scoping in `apps/api`, not only in the UI.
- Do not invent multi-tenant org tables, a permissions catalog table, or extra apps for branch/hub.
- Keep customer auth OTP-based (Redis); do not add customer passwords or MySQL OTP tables unless product docs change.
- Do not allow guest parcel booking; do allow unauthenticated tracking by tracking number.

## Quick domain map

- Org: `branches` → `hubs` → staff `users` (+ `user_hubs`)
- RBAC: `roles` → `user_roles`, `role_permissions`
- Customers: `customers` (TEMP/ACTIVE), `customer_addresses` (OTP portal; Redis for OTP)
- Network: `zones`, `pricing_rules`, `vehicles`, `routes`, `route_stops`
- Ops: `parcels` (+ `destination_zone_id`), `pickups`, `transfers`, `deliveries` (retries), `parcel_events`
- Money: `payments`, `settlements`
- Misc: `notifications`, `support_tickets`, `audit_logs`
