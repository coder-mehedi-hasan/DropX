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
3. **Customers are not RBAC users** — consent → TEMP customer → OTP verify → ACTIVE; OTP codes live in **Redis/cache only**.
4. **Phone and email unique** on `customers`.
5. **No guest booking**; **public tracking** by tracking number is allowed without login.
6. **Parcels can be created by customers and staff**.
7. **Hub scope** — `user_hubs` links staff to hubs.
8. **Riders are users** — `riders.user_id` → `users`; may also have console roles.
9. **Transfer drivers are staff** (`transfers.driver_id` → `users`), not riders.
10. **Delivery retries** — multiple `deliveries` rows per parcel via `attempt_no`.
11. **Pricing** — parcel stores `destination_zone_id`; fee uses destination zone rules.
12. **COD** — customer pays rider → remitted to company → company disburses via settlements; rider compensation (`compensation_type`) is separate.
13. **Parcels are the hub of the domain** — pickups, transfers, deliveries, payments, events hang off parcels.
14. **Schema changes** — update `migrate.sql` and keep `docs/er-diagram.md` in sync when tables/FKs change.
15. **RBAC / product changes** — update `docs/rbac.md` and `docs/overview.md`.

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
