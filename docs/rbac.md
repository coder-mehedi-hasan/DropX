# DropX — RBAC Rules

Permission keys are **static in application code**. The database only stores which keys each role has (`role_permissions.permission_key`). There is no `permissions` catalog table.

---

## Apps & who authenticates

| App          | Path          | Audience                            | Auth                             |
| ------------ | ------------- | ----------------------------------- | -------------------------------- |
| Customer web | `apps/web`    | Customers                           | OTP (phone or email)             |
| Rider app    | `apps/riders` | Riders                              | Email + password (`users`)       |
| Ops admin    | `apps/admin`  | Staff (admin, branch, hub, support) | Email + password (`users`)       |
| API          | `apps/api`    | All clients                         | Issues/validates sessions/tokens |

Branches and hubs do **not** get their own apps. Branch/hub staff use `apps/admin` with scoped roles.

---

## Actors

| Actor    | Identity table                                  | Portal        |
| -------- | ----------------------------------------------- | ------------- |
| Customer | `customers` (`TEMP` → `ACTIVE` after OTP)       | `apps/web`    |
| Rider    | `users` + `riders`                              | `apps/riders` |
| Staff    | `users` + `user_roles` (+ optional `user_hubs`) | `apps/admin`  |

Customers are **not** in RBAC. After OTP (ACTIVE only) they may access their own data and create parcels. Public tracking by tracking number does not require login.

A user may hold **both** `RIDER` and admin roles — allowed; API still enforces app-route boundaries per token/client.

Hub operators (and similar) are scoped via **`user_hubs`**, not only `users.branch_id`.

Transfer **drivers** are staff users (`transfers.driver_id`), not riders.

---

## Permission keys

Static constants used by `apps/api` and assigned to roles.

### Organization

| Key               | Allows                                     |
| ----------------- | ------------------------------------------ |
| `branches.view`   | List/view branches                         |
| `branches.manage` | Create/update/deactivate branches          |
| `hubs.view`       | List/view hubs                             |
| `hubs.manage`     | Create/update/deactivate hubs              |
| `users.view`      | List/view staff users                      |
| `users.manage`    | Create/update/suspend users, assign roles  |
| `roles.view`      | List/view roles                            |
| `roles.manage`    | Create/update roles and `role_permissions` |

### Customers & pricing

| Key                | Allows                                |
| ------------------ | ------------------------------------- |
| `customers.view`   | View customers                        |
| `customers.manage` | Create/update customers and addresses |
| `zones.view`       | View zones                            |
| `zones.manage`     | Create/update zones                   |
| `pricing.view`     | View pricing rules                    |
| `pricing.manage`   | Create/update pricing rules           |

### Fleet & network

| Key               | Allows                         |
| ----------------- | ------------------------------ |
| `vehicles.view`   | View vehicles                  |
| `vehicles.manage` | Create/update vehicles         |
| `routes.view`     | View routes                    |
| `routes.manage`   | Create/update routes and stops |
| `riders.view`     | View riders                    |
| `riders.manage`   | Create/update riders           |

### Parcels & operations

| Key                 | Allows                                       |
| ------------------- | -------------------------------------------- |
| `parcels.view`      | View parcels and events                      |
| `parcels.create`    | Create parcels                               |
| `parcels.update`    | Update parcel details/status (ops)           |
| `parcels.cancel`    | Cancel parcels                               |
| `pickups.view`      | View pickups                                 |
| `pickups.manage`    | Create/update pickups                        |
| `pickups.assign`    | Assign riders to pickups                     |
| `transfers.view`    | View transfers                               |
| `transfers.manage`  | Create/update transfers, load/unload parcels |
| `deliveries.view`   | View deliveries                              |
| `deliveries.manage` | Create/update deliveries, record proof       |
| `deliveries.assign` | Assign riders to deliveries                  |

### Money & support

| Key                  | Allows                     |
| -------------------- | -------------------------- |
| `payments.view`      | View payments              |
| `payments.manage`    | Record/update payments     |
| `settlements.view`   | View settlements           |
| `settlements.manage` | Create/process settlements |
| `notifications.view` | View notification logs     |
| `support.view`       | View support tickets       |
| `support.manage`     | Assign/resolve tickets     |
| `audit.view`         | View audit logs            |

### Rider app keys

| Key                     | Allows                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| `rider.jobs.view`       | View assigned pickups/deliveries                                 |
| `rider.jobs.update`     | Report an outcome: out for delivery, delivered, failed, returned |
| `rider.location.update` | Push live location                                               |
| `rider.proof.submit`    | Submit delivery proof                                            |

---

## Default roles

Seed these role names; assign keys via `role_permissions`.

### `ADMIN`

All keys except rider-only keys are optional; typically **every** admin key including `audit.view` and `roles.manage`. Full company scope (all branches/hubs).

### `BRANCH_MANAGER`

Scoped to `users.branch_id`.

- `hubs.view`, `hubs.manage` (own branch)
- `zones.view` — company-wide reference data, needed to set `originZoneId` / `destinationZoneId` when booking a parcel. Read only; `zones.manage` is pricing configuration and stays with `ADMIN`.
- `users.view` (own branch)
- `riders.view`, `riders.manage` (hubs in branch)
- `parcels.view`, `parcels.create`, `parcels.update`, `parcels.cancel`
- `pickups.*`, `transfers.*`, `deliveries.*`
- `customers.view`, `customers.manage`
- `vehicles.view`, `routes.view`
- `payments.view`, `support.view`, `support.manage`
- No: `branches.manage`, `roles.manage`, `pricing.manage`, `settlements.manage`, `audit.view` (unless granted)

### `HUB_OPERATOR`

Scoped via **`user_hubs`** (and usually `users.branch_id`).

- `hubs.view`
- `parcels.view`, `parcels.update`
- `pickups.view`, `pickups.manage`, `pickups.assign`
- `transfers.view`, `transfers.manage`
- `deliveries.view`, `deliveries.manage`, `deliveries.assign`
- `riders.view`
- `customers.view`
- No: org management, pricing, settlements, roles

### `DISPATCHER`

Focus on assignment across hubs in scope.

- `parcels.view`
- `pickups.view`, `pickups.assign`
- `deliveries.view`, `deliveries.assign`
- `transfers.view`
- `riders.view`
- `hubs.view`, `routes.view`

### `SUPPORT`

- `customers.view`
- `parcels.view`
- `support.view`, `support.manage`
- `notifications.view`
- No operational write on pickups/transfers/deliveries

### `FINANCE`

- `payments.view`, `payments.manage`
- `settlements.view`, `settlements.manage`
- `parcels.view`, `customers.view`
- `pricing.view`

### `RIDER`

Used only by `apps/riders`.

- `rider.jobs.view`
- `rider.jobs.update`
- `rider.location.update`
- `rider.proof.submit`

---

## Enforcement rules (`apps/api`)

1. **Admin & rider** — load `user` → roles → `permission_key` set; reject if required key missing.
2. **Customer** — OTP session identifies `customer_id`; never check `role_permissions`. Require `customers.status = ACTIVE`. Filter queries to that customer. Allow `parcels.create` for own bookings.
3. **Public tracking** — tracking-number lookup is public (no auth). Do not expose unrelated customer PII beyond tracking payload.
4. **No guest booking** — creating parcels as a customer requires ACTIVE OTP session.
5. **Branch scope** — if user has `branch_id` and is not `ADMIN`, restrict hubs/users/parcels/riders to that branch. (For `users` this is the `Scope` guard in `modules/users/users.repository.ts`, applied to list and read alike — an out-of-scope user id answers 404, not 403.)
6. **Hub scope** — restrict ops to hubs in `user_hubs` when the role requires hub scoping (e.g. `HUB_OPERATOR`).
7. **Rider scope** — rider may only see/update jobs where `assigned_rider_id` / `rider_id` is themselves. `GET /api/v1/jobs` filters on `deliveries.rider_id`; the rider never sends an id.
8. **App boundary** — prefer separate tokens/audiences per app; if a user has multiple roles, still only expose routes for the app they logged into.
9. **Delivery retry** — allow multiple `deliveries` per parcel (`attempt_no`); only one active attempt at a time (enforce in API).
10. **Permission keys** — never invent a permissions catalog table; add keys to `PERMISSIONS` in `apps/api/src/shared/auth/permissions.ts`, attach via `role_permissions`. `bun run db:seed` reconciles the two and reports keys that are granted but no longer in code.
11. **OTP** — store codes only in Redis/cache; never in MySQL.

---

## Role → portal map

| Role                                                                          | Allowed app   |
| ----------------------------------------------------------------------------- | ------------- |
| `ADMIN`, `BRANCH_MANAGER`, `HUB_OPERATOR`, `DISPATCHER`, `SUPPORT`, `FINANCE` | `apps/admin`  |
| `RIDER`                                                                       | `apps/riders` |
| (customer session)                                                            | `apps/web`    |
