# P1 Implementation Plan

## Status

**Batches 1–3 (staff users, roles/permission matrix, customer management) are implemented** — 13 ops
live (`admin.users.*` ×6, `admin.roles.{list,read,create,replacePermissions}`, and
`admin.customers.{list,read,activate}`), so 102 operations are registered in the admin registry
(99 at the end of Batch 2) and 107 on the running server with the five hand-written fragments.
Batches 4–7 below are plan only. Scope comes from
`docs/remaining-features.md`
Priority-1 groups (Organization & People + Money & Support): the unbuilt half of admin-plan
Phase 1 plus Phase 4 minus `stats`.

Decisions taken before writing this plan:

- **Audit writer is deferred to P2** (`docs/remaining-features.md` Priority-2). No screen, doc,
  or sidebar claim may say audit history exists until it does.
- **Notifications is writer + viewer together.** A viewer over an empty table looks like a
  finished-but-broken feature, so Batch 7 subscribes the event bus and writes `notifications`
  rows in the same batch that ships the outbox screen.
- **P0 open items do not block Batch 1.** The authenticated E2E pass on P0 batches 1–9 and the
  §3.4 sort-column fix are parallel debt, tracked at the end of this document.

Checklist:

- [x] **Batch 1 — Staff users** — 6 ops (`admin.users.{list,read,create,update,resetPassword,setStatus}`) + `admin.roles.list` pulled forward
- [x] **Batch 2 — Roles + permission matrix** — 4 ops (`admin.roles.{list,read,create,replacePermissions}`)
- [x] **Batch 3 — Customer management** — 3 ops (`admin.customers.{list,read,activate}`)
- [ ] **Batch 4 — Payments & COD** — 4 ops (`admin.payments.{list,read,record,refund}`)
- [ ] **Batch 5 — Settlements** — 4 ops (`admin.settlements.{list,read,create,setStatus}`)
- [ ] **Batch 6 — Support tickets** — 5 ops (`admin.support.{list,read,create,assign,updateStatus}`)
- [ ] **Batch 7 — Notifications outbox** — 2 ops (`admin.notifications.{list,retry}`) + event-bus writer

**Total: 28 planned ops → ~122 registered** (107 live today — 102 in the admin registry plus five
hand-written fragments — against 89 at the end of P0).

## How batches are built

Every batch uses the registry — one entry in `apps/api/src/modules/admin/registry.ts` plus one
handler in `apps/api/src/modules/admin/handlers.ts`. The registry derives the operation id, the
mounted path, the policy registration and the OpenAPI operation; there is no
`openapi/paths/*.openapi.ts` fragment and no id list to update. Batches 2–3 of P0 used
hand-written routes only because the registry was misdiagnosed as broken; that is corrected and
**no P1 batch repeats it.**

Conventions every batch follows, all inherited from P0:

- Domain logic in `apps/api/src/modules/{domain}/{domain}.{dto,repository,service}.ts`, co-located
  SQL, repositories take `Pool | Connection` so a caller can pass `tx`.
- Sort columns arrive from clients: use a **client-key → SQL-expression map** in the repository
  (the `rider-locations.repository.ts` shape), never an array allowlist — that is P0 §3.4.
- Split enum schemas: **no-default variant for list filters and PATCH**, `.default()` variant for
  **create only** — P0 §3.3.
- Admin screens follow `react-patterns`: `ServerDataTable`, URL state in
  `routes/<feature>-search-params.ts`, create/edit as `FormSheetShell` sheets, `AppToast` for
  success only.
- Every new read — including **scoped** and **sorted** variants — is added to
  `apps/api/scripts/check-read-paths.ts`.

## Dependencies & Order

```
Batch 1: Staff users              (no deps — bootstrap-admin is the only current users writer)
Batch 2: Roles + permission matrix (deps: roles table ✓ + permission catalog ✓)
Batch 3: Customer management       (no deps — customers table + OTP flow ✓)
Batch 4: Payments & COD            (deps: parcels ✓ + Batch 3 for COD display)
Batch 5: Settlements               (deps: Batch 4 — totals computed from payments)
Batch 6: Support tickets           (deps: Batch 3 — customer_id NOT NULL, assigned_to → users)
Batch 7: Notifications             (deps: event bus ✓; screens need nothing from 1-6)
```

Batches 1→2 are a pair (the matrix is what makes a created user's role meaningful). 4→5 are a
pair. 3, 6 and 7 can interleave with either pair.

---

## Batch 1 — Staff users (6 ops)

`admin.users.{list,read,create,update,resetPassword,setStatus}` — served at `/api/v1/admin/users`.

| File                                                                              | Action                         |
| --------------------------------------------------------------------------------- | ------------------------------ |
| `apps/api/src/modules/users/users.dto.ts`                                         | **new**                        |
| `apps/api/src/modules/users/users.repository.ts`                                  | **new**                        |
| `apps/api/src/modules/users/users.service.ts`                                     | **new**                        |
| `apps/api/src/modules/admin/registry.ts`                                          | **edit** — add `users` feature |
| `apps/api/src/modules/admin/handlers.ts`                                          | **edit**                       |
| `apps/admin/src/features/users/users-list-page.tsx`                               | **new**                        |
| `apps/admin/src/features/users/user-form-sheet.tsx`                               | **new**                        |
| `apps/admin/src/routes/users-search-params.ts`                                    | **new**                        |
| `apps/admin/src/lib/{endpoints,types,navigation}.ts`                              | **edit**                       |
| `apps/admin/src/{router.tsx,routes/app-routes.tsx,components/layout/sidebar.tsx}` | **edit**                       |
| `apps/api/scripts/check-read-paths.ts`                                            | **edit**                       |

Decisions:

- **Create writes three tables.** A staff member is a `users` row + `user_roles` rows +
  `user_hubs` rows in one transaction (roles and hub scope are what make the account usable;
  neither half is useful alone). `create` and `update` both accept `roleIds[]` and `hubIds[]`;
  `update` replaces both sets in the same transaction.
- **Account fields are create-only.** `PATCH /admin/users/:id` cannot touch `email` or `password`
  — same rule as P0 Batch 4, so two surfaces never write one `users` row. Name and status are
  editable.
- **`resetPassword` is its own operation** (not a PATCH field): it sets a server-generated or
  admin-supplied temporary password as a bcrypt hash and flips `must_change_password` to `TRUE`
  (column exists at `migrate.sql:76`; `auth.service.ts` already enforces the change-on-first-login
  flow for riders — staff reuse it).
- **`setStatus` is its own operation**, mirroring `admin.riders.setStatus`. `SUSPENDED` is the
  terminal state; a user with delivery/audit history is never deleted. The last `ADMIN` cannot be
  suspended — 409.
- **Hub scoping reads `user_hubs`.** The `Scope` guard in `auth-context.ts` already consumes it;
  nothing has ever written it except SQL. This batch is what makes that guard real for staff other
  than riders.

**Gate:** a branch manager can be created from the UI with a role and hub scope, signs in at
`/login`, and their `GET /admin/parcels` result set is demonstrably narrowed — this is the
admin-plan Phase 1 gate, and it is the P1 end-gate item this batch alone satisfies.

**Shipped — deviations from the plan above:**

- **`admin.roles.list` was pulled forward** into this batch (the user form's role picker needs
  it), so `apps/api/src/modules/roles/` exists as a list-only skeleton and Batch 2 ships three
  new ops (`read`, `create`, `replacePermissions`) against the same feature, tag and module.
- **`resetPassword` takes an admin-supplied password**, not a server-generated one: the request
  body requires it, and the sheet has a password field.
- **Open gap — `must_change_password` is not enforced for staff.** The flag is written `TRUE` on
  create and reset, but `auth.service.ts:145` reports it only for the `riders` audience and the
  admin app has no change-password gate, so the "staff reuse it" assumption in the decision
  above is not yet true. The API's OpenAPI text and the reset sheet say what actually happens
  (the new password works immediately). A staff change-password gate belongs with a later batch.
- **Verified:** 24-check authenticated smoke over HTTP (create/409 duplicate/422 bad ref/login
  of the new account/reset/suspend/sign-in refusal/filter/403 for a role without
  `users.manage`), the end-gate above with two hub-scoped managers whose parcel and user lists
  diverge as scoped (out-of-scope read 404, not 403), `check:read-paths` 229/229, and both
  apps' typecheck/build. The last-ADMIN 409 could not be exercised without touching the one
  real admin account; its query is covered by the read-path check.

---

## Batch 2 — Roles + permission matrix (4 ops)

`admin.roles.{list,read,create,replacePermissions}` — served at `/api/v1/admin/roles`.
**Shipped.** `list` shipped with Batch 1: `roles.{dto,repository,service}.ts` already carried the
list read, the registry the `roles` feature and tag. This batch added `read`, `create` and
`replacePermissions` (3 new ops; 99 registered after both batches, 104 on the server), the
permission matrix screen, and the `users.manage` lockout guard.

**Deviations from the decisions below (all intentional):**

- **Guard is the global invariant, not the planned narrower one.** The plan guarded "the last
  role whose holders include a member of the `ADMIN` role". The shipped guard fires whenever a
  replace drops `users.manage` from a role that currently holds it and **no other role grants it
  to any active staff** — a superset that also covers an `ADMIN` whose members hold a second,
  manage-granting role. 409 `INVALID_STATE_TRANSITION`, thrown inside the transaction before the
  write; verified by attempting to strip `users.manage` from `ADMIN` (the only holder) and
  asserting the 409 writes nothing.
- **No name/description edit.** The three-op scope has no `update`; "reuse by edit" under the
  `create` decision was aspirational. A role's profile is set at create and only its grants
  change afterwards. Matches the ops list — recorded so the delete line is not read as promising
  a rename.
- **Catalog is 44 keys, not ~48, and rider keys ride along.** `roles.read` returns all 44 with a
  granted flag (the 4 `rider.*` keys included, always false for staff); the admin matrix renders
  only the 40 non-rider keys. An unknown key in the PUT body is a 422 whose `details` names the
  field.
- **Matrix sheet reads on open.** The screen fetches `GET /roles/:id` when it opens — the list
  carries no grants — one request per open, cached, per "renders from one request". It is
  `FormSheetShell` + local checkbox state, not the RHF `FormSheet`, because the detail read
  resolves after mount and a resolver-bound form would reset to empty.
- **Picker consolidated.** Batch 1's `listRolesForPicker` became `listRoles`; the user form's role
  checkbox group and the roles screen share one endpoint function and one query helper.

**Verification.** Gates: typecheck (6 workspaces), `check:read-paths` 231/231, prettier, admin
build, boot with 104 registered ops + OpenAPI for the three new ones, unauth 401 on
GET/POST/PUT `/api/v1/admin/roles...`. Then the plan's gate verbatim in an authenticated smoke
(23/23 checks): create 201 + duplicate 409 + null-safe description; read gives a 44-key catalog
with granted flags and 404s on an unknown id; unknown-key and duplicate-key replaces are 422s;
the lockout guard 409 writes nothing (`ADMIN` unchanged); flip `BRANCH_MANAGER` `parcels.view`
off → the manager's **next** request 403s (`MISSING_PERMISSION`), and `roles.view`/`roles.manage`
never existed for it, so both matrix reads and writes 403 → restore → reachable again; an empty
key set is allowed for a role that never held `users.manage`. DB restored to pre-test state
afterwards.

Decisions (as planned):

| File                                                                              | Action   |
| --------------------------------------------------------------------------------- | -------- |
| `apps/api/src/modules/roles/roles.dto.ts`                                         | **new**  |
| `apps/api/src/modules/roles/roles.repository.ts`                                  | **new**  |
| `apps/api/src/modules/roles/roles.service.ts`                                     | **new**  |
| `apps/api/src/modules/admin/registry.ts`                                          | **edit** |
| `apps/api/src/modules/admin/handlers.ts`                                          | **edit** |
| `apps/admin/src/features/roles/roles-list-page.tsx`                               | **new**  |
| `apps/admin/src/features/roles/permission-matrix-sheet.tsx`                       | **new**  |
| `apps/admin/src/routes/roles-search-params.ts`                                    | **new**  |
| `apps/admin/src/lib/{endpoints,types,navigation}.ts`                              | **edit** |
| `apps/admin/src/{router.tsx,routes/app-routes.tsx,components/layout/sidebar.tsx}` | **edit** |
| `apps/api/scripts/check-read-paths.ts`                                            | **edit** |

Decisions:

- **`replacePermissions` takes the full key set** — a `PUT` that replaces, never merges, exactly
  like `PUT /routes/:id/stops`. Merge semantics cannot revoke, and revocation is the entire point:
  `apps/api/scripts/seed.ts` is `INSERT IGNORE` and never revokes, so today a misconfigured role
  is only fixable by hand-written SQL. The request body is the complete list of permission keys
  the role should hold; the diff is computed in one transaction (`DELETE` removed keys, `INSERT`
  new ones).
- **The matrix is a checkbox grid over the static catalog** — ~48 keys from `PERMISSIONS` in
  `apps/api/src/shared/auth/permissions.ts`, grouped by the sections `docs/rbac.md` uses. Keys
  stay static in code (architecture rule 2); the API never invents a key the code does not enforce.
  The response of `roles.read` includes the full catalog with a granted boolean per key, so the
  screen renders from one request.
- **Guard:** a `replacePermissions` that removes `users.manage` (or every permission) from the
  last role whose holders include a member of the `ADMIN` role is a 409. Without it, one save can
  lock every administrator out of the only screen that can undo it.
- **`create` roles exists, `delete` does not** — a role referenced by `user_roles` cannot be
  removed without orphaning accounts, same rationale as P0 Batch 4's no-delete. Reuse by edit.

**Gate:** flipping a checkbox on `BRANCH_MANAGER` and saving changes what that user can do on the
next request — verified by a second session or a token refresh, not by the UI's own state.

---

## Batch 3 — Customer management (3 ops)

`admin.customers.{list,read,activate}` — served at `/api/v1/admin/customers`.
**Shipped.** The `customers` feature is a registry entry + one module
(`customers.{dto,repository,service}.ts` — addresses embed in `read`, `activate` is the only
write), plus the `customerId` filter that got **added to `parcels.list`** (matched against both
sender and receiver) so the detail screen's parcel history is the existing list with one more
query param, not a duplicate implementation. The admin ships a list screen and a detail screen
(account card, addresses card, parcel history table, activate button behind
`customers.manage`).

**Deviations from the decisions below (all intentional):**

- **`activate` is idempotent and emits once.** The update runs with `WHERE status='TEMP'`
  (`UPDATE ... SET status='ACTIVE', activated_at=CURRENT_TIMESTAMP`), so a re-sent or repeated
  request returns the ACTIVE row unchanged instead of a 409/500, and `customer.activated` fires
  only when a transition actually happened — a double-fired button does not double-fire
  subscribers. `activated_at` is stamped on the admin path (OTP activation's EventWriter would
  carry its own meaning).
- **Wire-parity fix on the address shape.** `customer_addresses` response carries `customerId`
  so the route's DTO matches `@dropx/types` `CustomerAddress` (the declared type has the field;
  without the fix the mapper could never satisfy it). Addresses also come back ordered
  `is_default DESC, id ASC`, so a screen can render the default first without re-sorting.
- **`list` sort allowlist is `name, phone, status, createdAt` defaulting to `createdAt`** — the
  plan named no default; `status` is a genuine filter on this screen (support triages TEMP rows)
  so it is sortable like the users list sorts by status.

**Verification.** Gates: typecheck (6 workspaces), `check:read-paths` 242/242 (five customer
reads + a parcels `customerId` read), prettier, admin `build` (530ms), boot with 107 registered
ops + OpenAPI for all three new routes, unauth 401 on `/api/v1/admin/customers`. Then an
authenticated smoke (27/27 checks): search and `status=TEMP` filters both surface a TEMP fixture
— including to a **hub-scoped BRANCH_MANAGER**, proving customers are company-wide (no scope
leak out of the users/hubs tables); all four sort keys 200, bogus `sortBy`/`status` are 422s,
unknown id 404; detail embeds two addresses default-first with `customerId` echoed on each, and
an address-less customer returns `addresses: []`; the BRANCH_MANAGER activates the fixture (200,
`ACTIVE`, `activated_at` set) and a second activate is an idempotent 200; the activated customer
drops out of the `status=TEMP` filter; a **HUB_OPERATOR** — grants asserted to hold
`customers.view` but not `customers.manage` — reads the same customer 200 but activating it 403s
`MISSING_PERMISSION` and writes nothing (still TEMP); `parcels.list?customerId=<a real sender>`
returns exactly that customer's parcels (sender or receiver match) and an id with no history
returns an empty page. DB restored to pre-test state afterwards.

Decisions (as planned):

| File                                                                              | Action                         |
| --------------------------------------------------------------------------------- | ------------------------------ |
| `apps/api/src/modules/customers/customers.dto.ts`                                 | **new**                        |
| `apps/api/src/modules/customers/customers.repository.ts`                          | **new**                        |
| `apps/api/src/modules/customers/customers.service.ts`                             | **new**                        |
| `apps/api/src/modules/admin/registry.ts`                                          | **edit**                       |
| `apps/api/src/modules/admin/handlers.ts`                                          | **edit**                       |
| `apps/api/src/modules/parcels/parcels.{dto,repository}.ts`                        | **edit** — `customerId` filter |
| `apps/admin/src/features/customers/customers-list-page.tsx`                       | **new**                        |
| `apps/admin/src/features/customers/customer-detail-page.tsx`                      | **new**                        |
| `apps/admin/src/routes/customers-search-params.ts`                                | **new**                        |
| `apps/admin/src/lib/{endpoints,types,navigation,parcels}.ts`                      | **edit**                       |
| `apps/admin/src/{router.tsx,routes/app-routes.tsx,components/layout/sidebar.tsx}` | **edit**                       |
| `apps/api/scripts/check-read-paths.ts`                                            | **edit**                       |

Decisions:

- **Addresses are embedded in `read`**, not their own operation — `customer_addresses` is owned by
  the customer through the OTP portal; staff reads it, never writes it.
- **Parcel history is the existing `parcels.list`**, filtered by customer id — no second
  implementation of "this customer's parcels". If `parcels.list` lacks the filter parameter, add
  it there rather than joining parcels in this module.
- **`activate` is a support override, not the happy path.** Customers become `ACTIVE` through OTP
  verification (`auth.service.ts` emits `customer.activated`). Admin `activate` exists for the
  support case where OTP cannot be delivered; it is documented as an override and emits the same
  event so anything subscribed to activation fires identically.
- **TEMP customers appear in the list** with their status shown — hiding them would make the
  override unreachable.
- **No edit operation.** Name/contact fields are owned by the customer through the portal;
  `customers.manage` gates `activate` and nothing else mutates the row.

**Gate:** search a TEMP customer, activate them, and see their detail page (addresses + parcel
history) render without a 403 for a `BRANCH_MANAGER`.

---

## Batch 4 — Payments & COD (4 ops)

`admin.payments.{list,read,record,refund}` — served at `/api/v1/admin/payments`.

| File                                                                              | Action                                                   |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `apps/api/src/modules/payments/payments.dto.ts`                                   | **new**                                                  |
| `apps/api/src/modules/payments/payments.repository.ts`                            | **new**                                                  |
| `apps/api/src/modules/payments/payments.service.ts`                               | **new**                                                  |
| `packages/types/src/index.ts`                                                     | **edit** — `PAYMENT_TRANSITIONS`, `canTransitionPayment` |
| `apps/api/src/modules/admin/registry.ts`                                          | **edit**                                                 |
| `apps/api/src/modules/admin/handlers.ts`                                          | **edit**                                                 |
| `apps/admin/src/features/payments/payments-list-page.tsx`                         | **new**                                                  |
| `apps/admin/src/features/payments/payment-record-sheet.tsx`                       | **new**                                                  |
| `apps/admin/src/routes/payments-search-params.ts`                                 | **new**                                                  |
| `apps/admin/src/lib/{endpoints,types,navigation}.ts`                              | **edit**                                                 |
| `apps/admin/src/{router.tsx,routes/app-routes.tsx,components/layout/sidebar.tsx}` | **edit**                                                 |
| `apps/api/scripts/check-read-paths.ts`                                            | **edit**                                                 |

Decisions:

- **`record` writes the `payments` row only** — it does not move the parcel. Payment is bookkeeping
  against a parcel (`parcel_id NOT NULL`), not a lifecycle stage; `parcel_events` stay for
  operational transitions.
- **`refund` is a new `REFUND` row, not an edit of the original** — the original `PAID` row is the
  record of money received; a refund is a separate `type=REFUND` entry referencing the same parcel.
  Status `REFUNDED` on the original is stamped in the same transaction so the two can never
  disagree. Amount ≤ the refundable balance for that parcel, enforced server-side.
- **`PAYMENT_TRANSITIONS` in `@dropx/types`** — `PENDING → PAID` (record), `PAID → REFUNDED`
  (refund), `PENDING → FAILED`. The admin sheet offers exactly what the API enforces, mirroring
  `PICKUP_/TRANSFER_/DELIVERY_TRANSITIONS`.
- **Money is `DECIMAL(12,2)` on the wire as a string** — the repository returns MySQL's decimal
  string; no `Number()` round-trips through JSON.

**Gate:** record a COD payment against a delivered parcel, see it in the list with `PAID`, attempt
a refund above the balance (409), then refund a valid amount and see both rows.

---

## Batch 5 — Settlements (4 ops)

`admin.settlements.{list,read,create,setStatus}` — served at `/api/v1/admin/settlements`.

| File                                                                              | Action                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `apps/api/src/modules/settlements/settlements.dto.ts`                             | **new**                                                        |
| `apps/api/src/modules/settlements/settlements.repository.ts`                      | **new**                                                        |
| `apps/api/src/modules/settlements/settlements.service.ts`                         | **new**                                                        |
| `packages/types/src/index.ts`                                                     | **edit** — `SETTLEMENT_TRANSITIONS`, `canTransitionSettlement` |
| `apps/api/src/modules/admin/registry.ts`                                          | **edit**                                                       |
| `apps/api/src/modules/admin/handlers.ts`                                          | **edit**                                                       |
| `apps/admin/src/features/settlements/settlements-list-page.tsx`                   | **new**                                                        |
| `apps/admin/src/features/settlements/settlement-form-sheet.tsx`                   | **new**                                                        |
| `apps/admin/src/routes/settlements-search-params.ts`                              | **new**                                                        |
| `apps/admin/src/lib/{endpoints,types,navigation}.ts`                              | **edit**                                                       |
| `apps/admin/src/{router.tsx,routes/app-routes.tsx,components/layout/sidebar.tsx}` | **edit**                                                       |
| `apps/api/scripts/check-read-paths.ts`                                            | **edit**                                                       |

Decisions:

- **Totals are computed server-side, never accepted from the client.** `create` takes
  `customerId`, `periodStart`, `periodEnd`; the service aggregates `payments` for that customer in
  the period (`type=COD`, `status=PAID` → `total_cod`; `type=DELIVERY_FEE`, `status=PAID` →
  `delivery_charges`) and writes `net_amount` itself. Same rule as pricing (architecture rule 11):
  a client-typed total is the settlement lying.
- **`setStatus` follows the table's own vocabulary**: `PENDING → PROCESSING → PAID`, plus
  `→ FAILED`, and `FAILED → PENDING` for a retry. `paid_at` is stamped on `PAID`.
- **One settlement per `(customer_id, period_start, period_end)`** — enforced by locking the
  customer row before counting, the same `SELECT … FOR UPDATE` pattern as P0's one-open-attempt
  rules, so two concurrent creates cannot both win.
- **`SETTLEMENT_TRANSITIONS` in `@dropx/types`**, next to the others.

**Gate:** given recorded COD payments, create a period settlement and verify `total_cod` equals the
sum of that customer's in-period paid COD rows (not a number anyone typed), then carry it
`PENDING → PROCESSING → PAID`.

---

## Batch 6 — Support tickets (5 ops)

`admin.support.{list,read,create,assign,updateStatus}` — served at `/api/v1/admin/support/tickets`.

| File                                                                              | Action                                                   |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `apps/api/src/modules/support/support.dto.ts`                                     | **new**                                                  |
| `apps/api/src/modules/support/support.repository.ts`                              | **new**                                                  |
| `apps/api/src/modules/support/support.service.ts`                                 | **new**                                                  |
| `packages/types/src/index.ts`                                                     | **edit** — `SUPPORT_TRANSITIONS`, `canTransitionSupport` |
| `apps/api/src/modules/admin/registry.ts`                                          | **edit**                                                 |
| `apps/api/src/modules/admin/handlers.ts`                                          | **edit**                                                 |
| `apps/admin/src/features/support/support-list-page.tsx`                           | **new**                                                  |
| `apps/admin/src/features/support/support-detail-page.tsx`                         | **new**                                                  |
| `apps/admin/src/features/support/support-assign-sheet.tsx`                        | **new**                                                  |
| `apps/admin/src/routes/support-search-params.ts`                                  | **new**                                                  |
| `apps/admin/src/lib/{endpoints,types,navigation}.ts`                              | **edit**                                                 |
| `apps/admin/src/{router.tsx,routes/app-routes.tsx,components/layout/sidebar.tsx}` | **edit**                                                 |
| `apps/api/scripts/check-read-paths.ts`                                            | **edit**                                                 |

Decisions:

- **`assign` is its own operation** (not a PATCH field), matching P0 pickups — dispatch can be
  given `support.assign`-style authority through `support.manage` without conflating reassignment
  with resolution. `assigned_to` must be an active staff user (`users` row), validated.
- **Status vocabulary from the table**: `OPEN → IN_PROGRESS → RESOLVED → CLOSED`, plus
  `IN_PROGRESS → OPEN` for reopen. `SUPPORT_TRANSITIONS` in `@dropx/types`.
- **`parcel_id` is optional** — a ticket may or may not concern a parcel; when present it is
  validated and rendered as a link to the existing parcel detail page.
- **Scope:** tickets are readable through the same `Scope` guard as parcels — a hub-scoped user
  sees tickets attached to in-scope parcels plus unassigned ones; company-wide roles see all. The
  scoped `SELECT` joins `parcels` the way P0 Batch 6/8 taught: alias explicitly, exercise the
  scoped case in `check:read-paths`.

**Gate:** create a ticket against a parcel, assign it to a staff user, resolve it; confirm a
hub-scoped dispatcher cannot see another hub's ticket (scoped read-path case green).

---

## Batch 7 — Notifications outbox (2 ops + writer)

`admin.notifications.{list,retry}` — served at `/api/v1/admin/notifications`. Plus an event-bus
subscriber that writes `notifications` rows.

| File                                                                              | Action                       |
| --------------------------------------------------------------------------------- | ---------------------------- |
| `apps/api/src/modules/notifications/notifications.dto.ts`                         | **new**                      |
| `apps/api/src/modules/notifications/notifications.repository.ts`                  | **new**                      |
| `apps/api/src/modules/notifications/notifications.service.ts`                     | **new**                      |
| `apps/api/src/modules/notifications/dispatch.ts`                                  | **new** — subscribes the bus |
| `apps/api/src/modules/admin/registry.ts`                                          | **edit**                     |
| `apps/api/src/modules/admin/handlers.ts`                                          | **edit**                     |
| `apps/admin/src/features/notifications/notifications-list-page.tsx`               | **new**                      |
| `apps/admin/src/routes/notifications-search-params.ts`                            | **new**                      |
| `apps/admin/src/lib/{endpoints,types,navigation}.ts`                              | **edit**                     |
| `apps/admin/src/{router.tsx,routes/app-routes.tsx,components/layout/sidebar.tsx}` | **edit**                     |
| `apps/api/scripts/check-read-paths.ts`                                            | **edit**                     |

Decisions:

- **Writer and viewer ship together.** `apps/api/src/shared/events/bus.ts` already has 8 `emit()`
  calls (`parcel.created`, `parcel.status_changed`, `pickup.assigned`, `delivery.assigned`,
  `transfer.created/departed/arrived`, `customer.activated`) and zero subscribers. The subscriber
  maps each event to a `notifications` row (`channel`, `event_type`, `recipient`, `message`,
  `status=PENDING`). This is the minimum that makes the outbox screen show real data on day one.
- **Recipient resolution is best-effort per event** — customer events resolve to the customer's
  email/phone; rider events to the rider's user email. An event whose recipient cannot be resolved
  is logged and skipped, never thrown — a notification failure must not fail the business
  transaction that emitted it. The subscriber runs after the write, outside the caller's
  transaction, exactly like P0's post-transaction `emit()` calls.
- **`retry` flips `FAILED → PENDING`** and does not attempt delivery itself. Actual delivery
  (SMS/email provider) is out of scope and documented as such — the outbox is the record and the
  requeue, not the channel. A `SENT` row cannot be retried (409).
- **No `create` op.** Staff do not compose notifications; every row is an event's product, so the
  screen cannot drift from what the system actually emits.
- **`retry` permission:** `notifications.view` gates `list`; `retry` is a mutation and also uses
  `notifications.view` for now — `notifications.manage` does not exist in the catalog, and
  inventing a key that no code path otherwise uses is worse than reusing the one `docs/rbac.md`
  already documents for this feature.

**Gate:** trigger a parcel creation, see the row appear in the outbox `PENDING`; mark one
`FAILED` by hand (or simulate), retry it, and see it return to `PENDING`.

---

## Gate (after each batch)

```bash
bun run typecheck
bun run --cwd apps/api check:read-paths   # needs db:migrate; include scoped + sorted variants
bun run lint                              # pre-existing failures are not yours — check per-file
```

Plus, per batch: API boots with the new operation count, bijection + policy catalog + OpenAPI
coverage pass, unauthenticated probes return 401, `prettier --check` clean on touched files.

---

## P1 end gate

One authenticated browser session proving:

1. **Staff user → role matrix → scope.** Create a `BRANCH_MANAGER` with a hub scope, edit their
   role's grants in the matrix, sign in as them, and observe both the grant change and the narrowed
   list results.
2. **COD → settlement.** Record a payment, create a period settlement whose `total_cod` matches
   the server's aggregate, carry it to `PAID`.
3. **Ticket lifecycle.** Create → assign → resolve, with a scoped user blocked from another hub's
   ticket.
4. **Outbox.** A real emitted event lands as a row; `retry` requeues a `FAILED` one.

---

## Parallel debt — tracked, not blocking

| Item                                       | Note                                                                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated E2E pass on P0 batches 1–9   | Never run; every P0 gate was typecheck/build/read-path/boot/unauth-401. Highest-value single check: P0 Batch 4 rider can sign in.            |
| Sort-column fix (P0 §3.4)                  | Zones/vehicles/routes allowlists never match client keys. Fix as a standalone pass; P1 repositories copy the map pattern, not the allowlist. |
| `bun run lint` red repo-wide               | Pre-existing prettier `printWidth` mismatch (83 files). Never fold into a feature diff.                                                      |
| Audit writer → P2                          | Until it lands, nothing may claim audit history. Every P1 mutation service is a later retrofit — that cost is accepted, not forgotten.       |
| P0 §6.7 `BRANCH_MANAGER` `zones.view` seed | `DEFAULT_ROLE_GRANTS` has it; seeded rows need `bun run db:seed`, which writes to the shared remote DB and needs approval.                   |
| Empty test layer                           | Still zero tests; Batch 2 (permission matrix) and Batch 5 (settlement math) are the two most worth service-level tests when a runner lands.  |

---

## Summary

| Batch     | Features        | New API Ops | New Admin Screens | Status            |
| --------- | --------------- | ----------- | ----------------- | ----------------- |
| 1         | Staff users     | 6           | 2 + action        | implemented       |
| 2         | Roles + matrix  | 4           | 2                 | implemented       |
| 3         | Customers       | 3           | 2                 | planned           |
| 4         | Payments & COD  | 4           | 2                 | planned           |
| 5         | Settlements     | 4           | 2                 | planned           |
| 6         | Support tickets | 5           | 3                 | planned           |
| 7         | Notifications   | 2 + writer  | 1                 | planned           |
| **Total** | **7 features**  | **28 ops**  | **14 screens**    | **10 of 28 done** |
