# P0 Implementation Plan

## Status

Verified against the running API on 2026-10-05: **80 operations registered**, all documented in
`/openapi.json`. Batches 1–7 are built and gate-green; **batches 8–9 are not started**.

- [x] **Batch 1 — Zones + Vehicles** — 9 ops (`admin.zones.*` ×4, `admin.vehicles.*` ×5)
- [x] **Batch 2 — Pricing Rules** — 6 ops (`admin.pricing.{list,read,create,update,delete,match}`)
- [x] **Batch 3 — Routes + Stops** — 7 ops (`admin.routes.{list,read,create,update,delete,stopsList,stopsReplace}`)
- [x] **Batch 4 — Rider Management** — 5 ops (`admin.riders.{list,read,create,update,setStatus}`)
- [x] **Batch 5 — Rider Location Tracking** — 2 ops (`admin.riderLocations.list`, `job.recordLocation`)
- [x] **Batch 6 — Pickup Operations** — 5 ops (`admin.pickups.{list,read,create,assign,updateStatus}`)
- [x] **Batch 7 — Transfer Operations** — 8 ops (`admin.transfers.{list,read,create,update,delete,updateStatus,manifestList,manifestReplace}`)
- [ ] **Batch 8 — Delivery Management** — 0 of 5 ops. Not started.
- [ ] **Batch 9 — Delivery Proof** — 0 of 4 ops. Not started.

**Remaining: 2 batches, 9 ops, 3 admin screens.**

Rider-facing gaps, for contrast: the rider app (`apps/riders`) has only Jobs and Profile
(`bottom-nav.tsx`), backed by 4 ops (`job.list`, `job.read`, `job.reportOutcome`, `job.recordLocation`).
The one rider-app feature still missing is Batch 9 (proof submission) — rider _management_ is
admin-side by design and does not belong in the rider app.

## Registry vs hand-written routes

The plan's file table says to edit `admin/registry.ts` + `admin/handlers.ts` per feature. Batches 2
and 3 did **not** do this — they used standalone hand-written Hono routes plus a manual
`paths/*.openapi.ts` fragment, because adding a registry feature was failing typecheck at the time.

**That failure was a misdiagnosis, now corrected.** Batch 4 re-tested it: adding a `riders` feature to
`registry.ts` and `handlers.ts` typechecked, booted and generated its OpenAPI paths with no special
handling. `SurfaceHandlers<typeof ADMIN_SURFACE>` does not mis-map new feature keys. The earlier
failure was almost certainly the handler-map key not matching the registry feature key, which is
exactly what the boot-time bijection assertion exists to catch.

**From Batch 4 onward, use the registry.** It is one entry in `registry.ts` plus one handler, and it
derives the operation id, the mounted path, the policy registration and the OpenAPI operation — there
is no second file to keep in sync. The Batches 2–3 hand-written modules are left as they are; they work
and rewriting them is not worth the regression risk.

## Dependencies & Order

```
Batch 1: Zones + Vehicles          (no deps)
Batch 2: Pricing Rules              (deps: zones)
Batch 3: Routes + Stops             (deps: hubs ✓)
Batch 4: Rider Management           (deps: users ✓ + hubs ✓)
Batch 5: Rider Location Tracking    (deps: riders)
Batch 6: Pickup Operations          (deps: parcels ✓ + riders)
Batch 7: Transfer Operations        (deps: hubs ✓ + routes + vehicles)
Batch 8: Delivery Management        (deps: parcels ✓ + riders + hubs ✓)
Batch 9: Delivery Proof             (deps: deliveries)
```

---

## Batch 1 — Zones + Vehicles

**Status: done.** 9 operations registered (`admin.zones.*` ×4, `admin.vehicles.*` ×5, the fifth being
`POST /admin/vehicles/{id}/deactivate`). Two deviations from the file table below, both following the
codebase rather than the sketch:

- Routes are not per-file. `apps/admin/src/routes/app-routes.tsx` declares every route and
  `apps/admin/src/router.tsx` lists them in one hand-assembled tree, so adding a screen means adding a
  lazy component + route there and one line in the tree — not a new route file.
- List state lives in `routes/<feature>-search-params.ts` (schema, defaults, exported type), which is
  what `useQueryParams` and `resolveRedirect` both consume.

### Zones CRUD (4 ops: list, read, create, update)

| File                                                | Action                         |
| --------------------------------------------------- | ------------------------------ |
| `apps/api/src/modules/zones/zones.dto.ts`           | **new**                        |
| `apps/api/src/modules/zones/zones.repository.ts`    | **new**                        |
| `apps/api/src/modules/zones/zones.service.ts`       | **new**                        |
| `apps/api/src/modules/admin/registry.ts`            | **edit** — add `zones` feature |
| `apps/api/src/modules/admin/handlers.ts`            | **edit**                       |
| `apps/admin/src/features/zones/zones-list-page.tsx` | **new**                        |
| `apps/admin/src/features/zones/zone-form-sheet.tsx` | **new**                        |
| `apps/admin/src/routes/zones.tsx`                   | **new**                        |
| `apps/admin/src/lib/endpoints.ts`                   | **edit**                       |
| `apps/admin/src/lib/types.ts`                       | **edit**                       |
| `apps/admin/src/lib/navigation.ts`                  | **edit**                       |

### Vehicles CRUD (5 ops: list, read, create, update, deactivate)

Same file pattern as zones.

---

## Batch 2 — Pricing Rules CRUD (6 ops)

**Status: done.** 6 operations: list, read, create, update, delete, match. Served at
`/api/v1/pricing/rules` (not `/admin/pricing-rules`); operation ids remain `admin.pricing.*`.
Deliberately hand-written rather than in the registry — see Known deviation above.

| File                                                          | Action   |
| ------------------------------------------------------------- | -------- |
| `apps/api/src/modules/pricing/pricing-rules.dto.ts`           | **new**  |
| `apps/api/src/modules/pricing/pricing-rules.repository.ts`    | **new**  |
| `apps/api/src/modules/pricing/pricing-rules.service.ts`       | **new**  |
| `apps/api/src/modules/admin/registry.ts`                      | **edit** |
| `apps/api/src/modules/admin/handlers.ts`                      | **edit** |
| `apps/admin/src/features/pricing/pricing-rules-list-page.tsx` | **new**  |
| `apps/admin/src/features/pricing/pricing-rule-form-sheet.tsx` | **new**  |
| `apps/admin/src/routes/pricing-rules.tsx`                     | **new**  |
| `apps/admin/src/lib/endpoints.ts`                             | **edit** |
| `apps/admin/src/lib/types.ts`                                 | **edit** |
| `apps/admin/src/lib/navigation.ts`                            | **edit** |

---

## Batch 3 — Routes + Stops (8 ops)

**Status: done, at 7 ops not 8.** Route CRUD (list, read, create, update, delete) plus stops
list and stops replace. The plan's 8th op was implied to be a separate stop add/remove; both were
collapsed into `PUT /routes/{id}/stops`, which replaces the ordered set in one transaction — the DB
already enforces uniqueness on `(route_id, sequence_no)` and `(route_id, hub_id)`, so per-stop
endpoints would only add round trips. Also hand-written — see Known deviation above.

| File                                                  | Action   |
| ----------------------------------------------------- | -------- |
| `apps/api/src/modules/routes/routes.dto.ts`           | **new**  |
| `apps/api/src/modules/routes/routes.repository.ts`    | **new**  |
| `apps/api/src/modules/routes/routes.service.ts`       | **new**  |
| `apps/api/src/modules/admin/registry.ts`              | **edit** |
| `apps/api/src/modules/admin/handlers.ts`              | **edit** |
| `apps/admin/src/features/routes/routes-list-page.tsx` | **new**  |
| `apps/admin/src/features/routes/route-form-sheet.tsx` | **new**  |
| `apps/admin/src/routes/routes.tsx`                    | **new**  |
| `apps/admin/src/lib/endpoints.ts`                     | **edit** |
| `apps/admin/src/lib/types.ts`                         | **edit** |
| `apps/admin/src/lib/navigation.ts`                    | **edit** |

---

## Batch 4 — Rider Management (6 ops)

**Status: done, at 5 ops not 6.** list, read, create, update, setStatus — served at
`/api/v1/admin/riders`, built through the registry (see Registry vs hand-written routes above).

Deviations from the file table, all following the codebase:

- **5 ops, not 6.** The plan's implied sixth was presumably a delete, but a rider is not deletable —
  they own delivery history (`deliveries`, `parcels.rider_id`), so removing one would orphan the ops
  record. `SUSPENDED` is the terminal state instead, which is why `setStatus` is its own operation
  rather than a PATCH field.
- **No `routes/riders.tsx`.** Routes are declared in `app-routes.tsx` and listed in `router.tsx`;
  a separate route file is never how a screen is added here.
- **Create writes two tables.** A rider is a `users` row _and_ a `riders` row (rule 8), so
  `POST /admin/riders` creates the account the rider app signs in with, in the same transaction as the
  rider row. Account fields (`email`, `name`, `password`) are create-only: `PATCH` cannot touch them,
  so two surfaces never write one `users` row.

| File                                                  | Action   |
| ----------------------------------------------------- | -------- |
| `apps/api/src/modules/riders/riders.dto.ts`           | **new**  |
| `apps/api/src/modules/riders/riders.repository.ts`    | **new**  |
| `apps/api/src/modules/riders/riders.service.ts`       | **new**  |
| `apps/api/src/modules/admin/registry.ts`              | **edit** |
| `apps/api/src/modules/admin/handlers.ts`              | **edit** |
| `apps/admin/src/features/riders/riders-list-page.tsx` | **new**  |
| `apps/admin/src/features/riders/rider-form-sheet.tsx` | **new**  |
| `apps/admin/src/routes/riders.tsx`                    | **new**  |
| `apps/admin/src/lib/endpoints.ts`                     | **edit** |
| `apps/admin/src/lib/types.ts`                         | **edit** |
| `apps/admin/src/lib/navigation.ts`                    | **edit** |

---

## Batch 5 — Rider Location Tracking (2 ops)

**Status: done, at 2 ops.** `GET /admin/rider-locations` through the registry (read-only by
design) and `POST /jobs/locations` on the rider surface.

Two deviations from the file table:

- **The write lives on the rider surface, not the admin one.** A position is the rider's own to
  report, so there is no admin write operation — dispatch reads the trail and never writes into it.
  The rider id comes from the token, never from a body, so a rider cannot write into someone
  else's trail.
- **`recordedAt` is the device clock, bounded.** A phone with a wrong clock is common, so the
  instant is accepted — but a fix dated more than 5 minutes ahead is rejected, otherwise one bad
  clock pins a rider's "latest" position forever. A stale fix is still stored; it just cannot win.

| File                                                             | Action                                |
| ---------------------------------------------------------------- | ------------------------------------- |
| `apps/api/src/modules/riders/rider-locations.repository.ts`      | **new**                               |
| `apps/api/src/modules/riders/rider-locations.service.ts`         | **new**                               |
| `apps/api/src/modules/riders/rider-locations.dto.ts`             | **new**                               |
| `apps/api/src/modules/admin/registry.ts`                         | **edit**                              |
| `apps/api/src/modules/admin/handlers.ts`                         | **edit**                              |
| `apps/api/src/modules/jobs/jobs.routes.ts`                       | **edit** — add `POST /jobs/locations` |
| `apps/api/src/openapi/paths/jobs.openapi.ts`                     | **edit** — the rider-surface fragment |
| `apps/admin/src/features/riders/rider-locations-list-page.tsx`   | **new**                               |
| `apps/admin/src/routes/rider-locations-search-params.ts`         | **new**                               |
| `apps/riders/src/features/jobs/location-push.tsx`                | **new**                               |
| `apps/admin/src/lib/endpoints.ts` / `types.ts` / `navigation.ts` | **edit**                              |
| `apps/admin/src/routes/app-routes.tsx` / `router.tsx`            | **edit**                              |
| `apps/admin/src/components/layout/sidebar.tsx`                   | **edit**                              |

**The sort-column bug of §3.4 is not repeated here.** `rider-locations.repository.ts` uses a
client-key → SQL-expression map instead of an array allowlist, so `recordedAt` actually sorts.
Worth copying into zones, vehicles and routes as one standalone pass.

The rider push is a 2-minute interval, deliberately slow: the trail is a log that dispatch reads at
low resolution, and a rider app on mobile data should not spend battery writing rows nobody reads.
A failed push is dropped rather than queued — a 20-minute-old fix presented as current is worse than
no fix, because it looks live.

---

## Batch 6 — Pickup Operations (5 ops)

**Status: done.** 5 operations registered as `admin.pickups.{list,read,create,assign,updateStatus}`.

| File                                                                              | Action                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `apps/api/src/modules/pickups/pickups.dto.ts`                                     | **new**                                                |
| `apps/api/src/modules/pickups/pickups.repository.ts`                              | **new**                                                |
| `apps/api/src/modules/pickups/pickups.service.ts`                                 | **new**                                                |
| `packages/types/src/index.ts`                                                     | **edit** — `PICKUP_TRANSITIONS`, `canTransitionPickup` |
| `apps/api/src/db/sql.ts`                                                          | **edit** — `pageOf` accepts `Pool \| Connection`       |
| `apps/api/src/modules/parcels/parcels.repository.ts`                              | **edit** — bug fix, see below                          |
| `apps/api/src/modules/admin/registry.ts`                                          | **edit**                                               |
| `apps/api/src/modules/admin/handlers.ts`                                          | **edit**                                               |
| `apps/api/scripts/check-read-paths.ts`                                            | **edit**                                               |
| `apps/admin/src/features/pickups/pickups-list-page.tsx`                           | **new**                                                |
| `apps/admin/src/features/pickups/pickup-form-sheet.tsx`                           | **new**                                                |
| `apps/admin/src/features/pickups/pickup-assign-sheet.tsx`                         | **new**                                                |
| `apps/admin/src/features/pickups/pickup-status-sheet.tsx`                         | **new**                                                |
| `apps/admin/src/features/pickups/pickup-status.ts`                                | **new**                                                |
| `apps/admin/src/routes/pickups-search-params.ts`                                  | **new**                                                |
| `apps/admin/src/components/reference-combobox.tsx`                                | **edit** — added a `riders` source                     |
| `apps/admin/src/lib/{endpoints,format,navigation,types}.ts`                       | **edit**                                               |
| `apps/admin/src/{router.tsx,routes/app-routes.tsx,components/layout/sidebar.tsx}` | **edit**                                               |

Deviations from the plan's file table, and why:

- **`apps/admin/src/routes/pickups.tsx` was not created.** Every list screen in this app keeps its
  search schema in `src/routes/<name>-search-params.ts` and its route in `app-routes.tsx`; a
  route-per-file convention that exists in only one screen is a convention nobody follows.
- **`PICKUP_TRANSITIONS` went into `@dropx/types`, not the service.** The status sheet offers exactly
  the moves the table allows, so the table has to be shared. This mirrors `PARCEL_TRANSITIONS`, which
  is already there for the same reason.
- **Two extra sheets rather than one.** `pickup-form-sheet` (create), `pickup-assign-sheet` (assign)
  and `pickup-status-sheet` (every other status) are separate because each posts a different body to a
  different operation; one sheet branching on three shapes would be worse than three small ones.

Decisions worth remembering:

- **A pickup is scoped through its parcel**, not through a hub of its own: every read and both writes
  join `parcels` and reuse `applyScope` from `parcels.repository.ts`. One definition of "which hub is
  this parcel at" — a second one in this module would drift, and the scope check is what must not be
  lenient.
- **`parcelId` in the create body accepts an id _or_ a tracking number.** The row id is never shown to
  a human, and the tracking number is the only string a customer can read out over the phone, so an
  id-only field would make the whole create path unusable.
- **One open pickup per parcel**, enforced by locking the parcel row (`SELECT … FOR UPDATE`) before
  counting open pickups, so two concurrent creates cannot both pass the check.
- **`PICKED_UP` also moves the parcel** to `PICKED_UP` and writes a `PICKED_UP` parcel event, in the
  same transaction. A customer watching a parcel sit at `CREATED` while dispatch believes it was
  collected is the failure this prevents.
- **`pickups.assign` is a separate permission from `pickups.manage`**, so dispatch can be given the
  authority to send a rider without also gaining the authority to fail or cancel a pickup.

### Bug found and fixed while doing Batch 6

`parcels.listParcels` built its `FROM` without the `scope_hub` join that `applyScope` writes
`scope_hub.branch_id` / `scope_hub.id` against, so **every scoped parcel read failed** —
`Unknown column 'scope_hub.branch_id' in 'where clause'`. It worked for an `ADMIN` (whose scope emits
no clause at all) and 500'd for every branch manager and hub-scoped dispatcher.

`check:read-paths` missed it because all its cases used a company-wide scope. Four scoped cases were
added (`parcels.listParcels(branch-scoped)`, `(hub-scoped)`, `findParcelById(branch-scoped)`,
`(hub-scoped)`), plus scoped cases for every pickup read. The lesson is now in the script's comments:
a scope clause that names an unjoined alias fails _only_ for a scoped caller, so a scoped read must be
exercised or nothing proves the guard works.

---

## Batch 7 — Transfer Operations (8 ops)

**Status: done.** 8 operations: list, read, create, update, delete, updateStatus, manifestList,
manifestReplace — served at `/api/v1/admin/transfers`, built through the registry.

Deviations from the plan's file table, all following the codebase:

- **No `routes/transfers.tsx`.** Screen state lives in
  `apps/admin/src/routes/transfers-search-params.ts`; the route is declared in `app-routes.tsx`
  and listed in `router.tsx`, same as every other list screen.
- **`transfer-status-sheet.tsx` + `transfer-status.ts` instead of a plan-listed third sheet.**
  Create = `transfer-form-sheet`, manifest edit = `transfer-manifest-sheet`, every other
  transition = `transfer-status-sheet` (the moves table comes from `TRANSFER_TRANSITIONS` in
  `@dropx/types`, mirroring `PICKUP_TRANSITIONS`).

| File                                                            | Action   |
| --------------------------------------------------------------- | -------- |
| `apps/api/src/modules/transfers/transfers.dto.ts`               | **new**  |
| `apps/api/src/modules/transfers/transfers.repository.ts`        | **new**  |
| `apps/api/src/modules/transfers/transfers.service.ts`           | **new**  |
| `apps/api/src/modules/admin/registry.ts`                        | **edit** |
| `apps/api/src/modules/admin/handlers.ts`                        | **edit** |
| `apps/admin/src/features/transfers/transfers-list-page.tsx`     | **new**  |
| `apps/admin/src/features/transfers/transfer-form-sheet.tsx`     | **new**  |
| `apps/admin/src/features/transfers/transfer-manifest-sheet.tsx` | **new**  |
| `apps/admin/src/routes/transfers.tsx`                           | **new**  |
| `apps/admin/src/lib/endpoints.ts`                               | **edit** |
| `apps/admin/src/lib/types.ts`                                   | **edit** |
| `apps/admin/src/lib/navigation.ts`                              | **edit** |

---

## Batch 8 — Delivery Management (5 ops)

**Status: NOT STARTED.** Dependencies met (parcels + riders + hubs exist).

| File                                                           | Action   |
| -------------------------------------------------------------- | -------- |
| `apps/api/src/modules/deliveries/deliveries.dto.ts`            | **new**  |
| `apps/api/src/modules/deliveries/deliveries.repository.ts`     | **new**  |
| `apps/api/src/modules/deliveries/deliveries.service.ts`        | **new**  |
| `apps/api/src/modules/admin/registry.ts`                       | **edit** |
| `apps/api/src/modules/admin/handlers.ts`                       | **edit** |
| `apps/admin/src/features/deliveries/deliveries-list-page.tsx`  | **new**  |
| `apps/admin/src/features/deliveries/delivery-assign-sheet.tsx` | **new**  |
| `apps/admin/src/routes/deliveries.tsx`                         | **new**  |
| `apps/admin/src/lib/endpoints.ts`                              | **edit** |
| `apps/admin/src/lib/types.ts`                                  | **edit** |
| `apps/admin/src/lib/navigation.ts`                             | **edit** |

---

## Batch 9 — Delivery Proof Submission (4 ops)

**Status: NOT STARTED.** Blocked on Batch 8 (proofs hang off a delivery attempt).

| File                                                               | Action                             |
| ------------------------------------------------------------------ | ---------------------------------- |
| `apps/api/src/modules/deliveries/delivery-proofs.repository.ts`    | **new**                            |
| `apps/api/src/modules/deliveries/delivery-proofs.service.ts`       | **new**                            |
| `apps/api/src/modules/admin/registry.ts`                           | **edit**                           |
| `apps/api/src/modules/admin/handlers.ts`                           | **edit**                           |
| `apps/api/src/modules/jobs/jobs.routes.ts`                         | **edit** — add `POST /jobs/proofs` |
| `apps/admin/src/features/deliveries/delivery-proofs-list-page.tsx` | **new**                            |
| `apps/admin/src/routes/delivery-proofs.tsx`                        | **new**                            |
| `apps/riders/src/features/jobs/delivery-proof-sheet.tsx`           | **new**                            |
| `apps/riders/src/lib/api.ts`                                       | **edit**                           |

---

## Gate (after each batch)

```bash
bun run typecheck
bun run --cwd apps/api check:read-paths   # needs db:migrate
bun run lint
```

---

## Summary

| Batch     | Features         | New API Ops | New Admin Screens | New Files     | Status                |
| --------- | ---------------- | ----------- | ----------------- | ------------- | --------------------- |
| 1         | Zones, Vehicles  | 9           | 4                 | ~12           | done                  |
| 2         | Pricing Rules    | 6           | 2                 | ~8            | done                  |
| 3         | Routes + Stops   | 7           | 2                 | ~8            | done                  |
| 4         | Rider Management | 5           | 2                 | ~8            | done                  |
| 5         | Rider Locations  | 2           | 1                 | ~7            | done                  |
| 6         | Pickups          | 5           | 2                 | ~8            | done                  |
| 7         | Transfers        | 8           | 3                 | ~10           | done                  |
| 8         | Deliveries       | 5           | 2                 | ~8            | **not started**       |
| 9         | Delivery Proofs  | 4           | 1                 | ~7            | **not started**       |
| **Total** | **10 features**  | **51 ops**  | **19 screens**    | **~75 files** | **42 of 51 ops done** |

Ops actually shipped: 9 + 6 + 7 + 5 + 2 + 5 + 8 = **42**, against 51 planned. The API registered **80**
operations at last boot; the other 38 predate the P0 plan (auth, health, tracking, parcels, jobs,
customer).

Two batches came in one op short, both deliberately: Batch 3 folded stop add/remove into a single
`PUT`, and Batch 4 has no delete because a rider owns delivery history and is suspended instead. See
those batches' status notes.
