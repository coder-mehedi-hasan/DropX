# AGENTS.md

Guidance for AI agents working on **DropX**.

## What this project is

Single-tenant parcel delivery & logistics platform for one courier company. Full lifecycle: create → pickup → hub/transfer → last-mile delivery → COD/payments → settlements.

Canonical product docs:

- [`docs/overview.md`](docs/overview.md) — system overview, portals, login
- [`docs/rbac.md`](docs/rbac.md) — roles, permission keys, enforcement
- [`docs/er-diagram.md`](docs/er-diagram.md) — ER diagram
- [`migrate.sql`](migrate.sql) — MySQL schema (source of truth for DB)

## Monorepo apps

```text
apps/
  web/       # Customer portal (OTP phone/email)
  riders/    # Rider app (email + password)
  console/   # Admin / ops console (email + password)
  api/       # Backend API for all clients
```

| App | Audience | Auth |
|-----|----------|------|
| `apps/web` | Customers | OTP to phone or email — no password |
| `apps/riders` | Riders | `users` email + password; row in `riders` |
| `apps/console` | Staff | `users` email + password + RBAC |
| `apps/api` | All of the above | Auth, business logic, DB access |

**Do not** create separate portals for branches or hubs. Branch/hub staff use `apps/console` with role + branch/hub scoping.

## Architecture rules

1. **Single tenant** — one company per deployment; no org_id multi-tenancy.
2. **Permission keys are static in code** — stored only as strings on `role_permissions (role_id, permission_key)`. No `permissions` table.
3. **Customers are not RBAC users** — OTP session → `customers` row; access only own data.
4. **Riders are users** — `riders.user_id` → `users`; rider role keys are `rider.*`.
5. **Parcels are the hub of the domain** — pickups, transfers, deliveries, payments, events hang off parcels.
6. **Schema changes** — update `migrate.sql` and keep `docs/er-diagram.md` in sync when tables/FKs change.
7. **RBAC changes** — update `docs/rbac.md` when adding roles or permission keys.

## Where to put work

| Change | Put it in |
|--------|-----------|
| Customer UI / OTP login UX | `apps/web` |
| Rider jobs, location, proof UI | `apps/riders` |
| Admin/ops screens, branch/hub mgmt | `apps/console` |
| Auth, permissions checks, domain APIs | `apps/api` |
| Tables / indexes / FKs | `migrate.sql` |
| Product / auth / RBAC docs | `docs/` |

## Coding expectations

- Prefer small, focused diffs; match existing patterns in the app you touch.
- Enforce permission keys and customer/rider scoping in `apps/api`, not only in the UI.
- Do not invent multi-tenant org tables, a permissions catalog table, or extra apps for branch/hub.
- Keep customer auth OTP-based; do not add customer passwords unless product docs change.

## Quick domain map

- Org: `branches` → `hubs` → staff `users`
- RBAC: `roles` → `user_roles`, `role_permissions`
- Customers: `customers`, `customer_addresses` (OTP portal)
- Network: `zones`, `pricing_rules`, `vehicles`, `routes`, `route_stops`
- Ops: `parcels`, `pickups`, `transfers`, `deliveries`, `parcel_events`
- Money: `payments`, `settlements`
- Misc: `notifications`, `support_tickets`, `audit_logs`
