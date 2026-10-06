# DropX — System Overview

DropX is a **single-tenant** parcel delivery and logistics management platform for one courier company. It covers the full parcel lifecycle: creation, pickup, hub processing, inter-hub transfer, last-mile delivery, COD/payments, settlements, and customer support.

---

## Apps

```text
apps/
  web/       # Customer portal
  riders/    # Rider app
  admin/     # Admin / ops portal
  api/       # Backend API
packages/
  db/        # Database port + MySQL adapter
  ui/        # Shared design tokens and components
```

| App           | Audience                                                           | Login                                                          |
| ------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `apps/web`    | Customers (senders / receivers)                                    | **OTP** via phone or email                                     |
| `apps/riders` | Pickup / delivery riders                                           | Email + password (`users`)                                     |
| `apps/admin`  | Admins, branch staff, hub operators, dispatchers, support, finance | Email + password (`users`) + RBAC                              |
| `apps/api`    | All clients                                                        | Validates sessions/tokens; enforces permissions and data scope |

`bun run dev` starts all four apps together via `mprocs`. The three frontends share tokens and components from `packages/ui`; all data access goes through the API's database layer in `apps/api/src/db/`.

Branches and hubs are **not** separate apps. Their staff use `apps/admin` with role- and branch/hub-scoped access. See [`rbac.md`](./rbac.md).

Public **tracking** (by tracking number only) is available without login. **Booking / creating parcels as a customer** requires OTP login — no guest booking.

The public website also exposes `/become-a-rider` for recruitment. Applications capture contact
details, district, vehicle, availability, and experience in `rider_applications` with `PENDING`
status. Submission does not create a rider account; staff review the application and then use the
existing rider setup flow to assign a hub, employee code, password, and permissions.

---

## Login flows

### Customer OTP (`apps/web`)

1. User enters phone or email and **accepts consent**.
2. API creates a **TEMP** `customers` row (if new) and stores the OTP in **Redis/cache** (not MySQL).
3. User verifies OTP → customer becomes **ACTIVE**; session issued for the portal.
4. Phone and email are **unique** on `customers`.

OTP codes are short-lived and never persisted in the database.

### Staff (`apps/admin`)

Email + `password_hash` on `users`, plus roles → `role_permissions`. Permission keys are static in code.

Staff accounts are managed from the admin **Users** screen (`/users`, `users.view` /
`users.manage`): create writes the account with its roles and hub scope in one transaction,
passwords change only via **reset** (never as an edit field), and a user is suspended rather
than deleted. The last active `ADMIN` cannot be suspended.

Hub-scoped staff are linked via **`user_hubs`** (many hubs per user). Branch scope still uses `users.branch_id`.

Roles and their grants are managed from the admin **Roles** screen (`/roles`, `roles.view` /
`roles.manage`): a role is created with a name and description, then given a set of permission
keys in the permission matrix. Saving replaces the whole key set. The API refuses a save that
would strip `users.manage` from every role that grants it — the last administrator who can undo
the change cannot be locked out by the screen that exists to change it. The catalog itself is
never edited at runtime: a role can only hold the keys the code defines and the screen renders.

### Rider (`apps/riders`)

Same password login as staff. Each rider has `riders.user_id` → `users` and the `RIDER` role. A user **may** also hold admin roles (e.g. rider + hub operator) — allowed.

A rider reaches its own surface at `/api/v1/jobs`, gated on `rider.jobs.view` /
`rider.jobs.update` and the `riders` audience. A rider reports one of four
outcomes — `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`, `RETURNED` — and the API
moves the open `deliveries` attempt and the customer-visible `parcels.status` in
the same transaction. `FAILED` and `RETURNED` require a reason. Riders never
receive the admin `parcels.*` keys, so a rider token cannot reach `/api/v1/parcels`.

---

## Organization

- **Branches** — regional offices; managed in admin.
- **Hubs** — origin / sorting / transit / destination nodes under a branch.
- **Users** — staff and riders; optional `branch_id`; roles; optional hub assignments via `user_hubs`.
- **Riders** — operational profile + home hub; `compensation_type` (salaried / contractual / commission / mixed); location history in `rider_locations`.
- **Transfer drivers** — separate staff (`transfers.driver_id` → `users`), not riders.

---

## Customers

- Individual or business; **unique phone**; **unique email** (email optional).
- Status: `TEMP` (consented, awaiting OTP) → `ACTIVE` (verified).
- Multiple addresses.
- After OTP: create/book parcels, track own parcels, manage addresses, open tickets.
- Anyone (logged in or not) can **publicly track** by tracking number.

---

## Zones & Pricing

- **Zones** — geographic pricing areas.
- **Pricing rules** — origin/destination zone, weight band, fees.
- On each parcel, **`destination_zone_id`** is required; fee calculation uses the destination zone (with weight and COD rules).

---

## Vehicles & Routes

- **Vehicles** — bike, van, truck, etc., used on transfers.
- **Routes** — hub-to-hub paths with ordered **route stops**.

---

## Parcel lifecycle

```text
CREATED → PICKED_UP → IN_TRANSIT / AT_HUB → OUT_FOR_DELIVERY → DELIVERED
                                                                    ↘ FAILED / CANCELLED / RETURNED
```

1. **Create** — by **customer** (`apps/web`) or **staff** (`apps/admin`); sender/receiver, hubs, destination zone, weight, prepaid or COD.
2. **Pickup** — assign rider; track pickup status.
3. **Transfer** — load onto hub-to-hub transfer (vehicle, route, **staff driver**).
4. **Delivery** — last-mile from destination hub; proof (signature, photo, OTP, identity). **Retries allowed** — new `deliveries` row with next `attempt_no` after FAILED/CANCELLED.
5. **Events** — `parcel_events` for full tracking history.

Parcels are the center of the model: items, pickups, transfers, deliveries, payments, notifications, and tickets link to them.

---

## Payments, COD & Settlements

- **Simple COD flow:** customer pays the **rider** on delivery → funds are remitted to the **company** → company **disburses** to the merchant/sender via settlements.
- Rider pay to the company is separate: salaried, contractual, commission, or mixed (`riders.compensation_type`) — not the same as customer COD.
- **Payments** — delivery fee, COD, refunds (cash, bKash, Nagad, card, bank, online).
- **Settlements** — period payouts to customers (especially business COD).

---

## Notifications & Support

- SMS / email / push about parcel events.
- Support tickets for a customer (optional parcel), assignable to staff in admin.

---

## Security

- Staff RBAC: `roles` → `user_roles` → users; `role_permissions` stores static `permission_key` values.
- Hub scope: `user_hubs`.
- Customer access: OTP session + own-data filters; TEMP customers cannot use portal until ACTIVE.
- Rider access: own assigned jobs + location/proof APIs.
- Public tracking: tracking number only (no PII beyond what tracking intentionally exposes).
- OTP: Redis/cache only.
- Audit: `audit_logs` for staff actions.

Full matrix: [`rbac.md`](./rbac.md).

---

## Tech notes

- Database: MySQL 8.0+
- Schema: [`migrate.sql`](../migrate.sql)
- ER diagram: [`er-diagram.md`](./er-diagram.md)
- Agent guide: [`AGENTS.md`](../AGENTS.md)
- OTP / short-lived auth codes: Redis (or equivalent cache), not MySQL
- API base: `/api/v1` (health also served unversioned at `/health`)
- Lists return `{ nodes, meta }`; errors return `{ error: { code, message, details? } }`
- Each repository in `apps/api/src/modules/{domain}` runs raw SQL against `apps/api/src/db/pool.ts` (the single process-wide `mysql2` pool bound to every request as `c.db`). `migrate.sql` is the source of truth for the schema.
- **OpenAPI 3.1** at `/openapi.json`, **Swagger UI** at `/docs` (public, unversioned)
  - Schemas are derived from the Zod DTOs, so the documented contract and the runtime
    validation are the same object rather than two descriptions that can drift
  - `apps/api/src/openapi/coverage.ts` fails the boot unless every policy-catalog
    operation is documented and every documented operation is enforced
  - Both directions are asserted at boot by `apps/api/src/openapi/coverage.ts`
