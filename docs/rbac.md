# DropX — RBAC Rules

Permission keys are **static in application code**. The database only stores which keys each role has (`role_permissions.permission_key`). There is no `permissions` catalog table.

---

## Apps & who authenticates

| App | Path | Audience | Auth |
|-----|------|----------|------|
| Customer web | `apps/web` | Customers | OTP (phone or email) |
| Rider app | `apps/riders` | Riders | Email + password (`users`) |
| Ops console | `apps/console` | Staff (admin, branch, hub, support) | Email + password (`users`) |
| API | `apps/api` | All clients | Issues/validates sessions/tokens |

Branches and hubs do **not** get their own apps. Branch/hub staff use `apps/console` with scoped roles.

---

## Actors

| Actor | Identity table | Portal |
|-------|----------------|--------|
| Customer | `customers` | `apps/web` |
| Rider | `users` + `riders` | `apps/riders` |
| Staff | `users` + `user_roles` | `apps/console` |

Customers are **not** in RBAC. After OTP login they may only access their own data (parcels where they are sender/receiver, their addresses, their tickets).

---

## Permission keys

Static constants used by `apps/api` and assigned to roles.

### Organization

| Key | Allows |
|-----|--------|
| `branches.view` | List/view branches |
| `branches.manage` | Create/update/deactivate branches |
| `hubs.view` | List/view hubs |
| `hubs.manage` | Create/update/deactivate hubs |
| `users.view` | List/view staff users |
| `users.manage` | Create/update/suspend users, assign roles |
| `roles.view` | List/view roles |
| `roles.manage` | Create/update roles and `role_permissions` |

### Customers & pricing

| Key | Allows |
|-----|--------|
| `customers.view` | View customers |
| `customers.manage` | Create/update customers and addresses |
| `zones.view` | View zones |
| `zones.manage` | Create/update zones |
| `pricing.view` | View pricing rules |
| `pricing.manage` | Create/update pricing rules |

### Fleet & network

| Key | Allows |
|-----|--------|
| `vehicles.view` | View vehicles |
| `vehicles.manage` | Create/update vehicles |
| `routes.view` | View routes |
| `routes.manage` | Create/update routes and stops |
| `riders.view` | View riders |
| `riders.manage` | Create/update riders |

### Parcels & operations

| Key | Allows |
|-----|--------|
| `parcels.view` | View parcels and events |
| `parcels.create` | Create parcels |
| `parcels.update` | Update parcel details/status (ops) |
| `parcels.cancel` | Cancel parcels |
| `pickups.view` | View pickups |
| `pickups.manage` | Create/update pickups |
| `pickups.assign` | Assign riders to pickups |
| `transfers.view` | View transfers |
| `transfers.manage` | Create/update transfers, load/unload parcels |
| `deliveries.view` | View deliveries |
| `deliveries.manage` | Create/update deliveries, record proof |
| `deliveries.assign` | Assign riders to deliveries |

### Money & support

| Key | Allows |
|-----|--------|
| `payments.view` | View payments |
| `payments.manage` | Record/update payments |
| `settlements.view` | View settlements |
| `settlements.manage` | Create/process settlements |
| `notifications.view` | View notification logs |
| `support.view` | View support tickets |
| `support.manage` | Assign/resolve tickets |
| `audit.view` | View audit logs |

### Rider app keys

| Key | Allows |
|-----|--------|
| `rider.jobs.view` | View assigned pickups/deliveries |
| `rider.jobs.update` | Update job status (picked up, delivered, failed) |
| `rider.location.update` | Push live location |
| `rider.proof.submit` | Submit delivery proof |

---

## Default roles

Seed these role names; assign keys via `role_permissions`.

### `ADMIN`

All keys except rider-only keys are optional; typically **every** console key including `audit.view` and `roles.manage`. Full company scope (all branches/hubs).

### `BRANCH_MANAGER`

Scoped to `users.branch_id`.

- `hubs.view`, `hubs.manage` (own branch)
- `users.view` (own branch)
- `riders.view`, `riders.manage` (hubs in branch)
- `parcels.view`, `parcels.create`, `parcels.update`, `parcels.cancel`
- `pickups.*`, `transfers.*`, `deliveries.*`
- `customers.view`, `customers.manage`
- `vehicles.view`, `routes.view`
- `payments.view`, `support.view`, `support.manage`
- No: `branches.manage`, `roles.manage`, `pricing.manage`, `settlements.manage`, `audit.view` (unless granted)

### `HUB_OPERATOR`

Scoped to assigned hub(s). Typically `users.branch_id` plus hub filter in API.

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

1. **Console & rider** — load `user` → roles → `permission_key` set; reject if required key missing.
2. **Customer** — OTP session identifies `customer_id`; never check `role_permissions`. Filter all queries to that customer.
3. **Branch scope** — if user has `branch_id` and is not `ADMIN`, restrict hubs/users/parcels/riders to that branch.
4. **Hub scope** — `HUB_OPERATOR` (and similar) may only act on parcels/jobs tied to their hub.
5. **Rider scope** — rider may only see/update jobs where `assigned_rider_id` / `rider_id` is themselves.
6. **App boundary** — console tokens must not call rider-only routes; rider tokens must not call console admin routes; customer tokens only hit customer routes.
7. **Permission keys** — never invent DB rows for a permissions catalog; add new keys in code, then attach them to roles in `role_permissions`.

---

## Role → portal map

| Role | Allowed app |
|------|-------------|
| `ADMIN`, `BRANCH_MANAGER`, `HUB_OPERATOR`, `DISPATCHER`, `SUPPORT`, `FINANCE` | `apps/console` |
| `RIDER` | `apps/riders` |
| (customer session) | `apps/web` |
