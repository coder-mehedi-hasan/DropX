# P0 Implementation Plan

## Status

Verified against the running API on 2026-10-05: **65 operations registered**, all documented in
`/openapi.json`. Batches 1–4 are built and gate-green; **batches 5–9 are not started**.

- [x] **Batch 1 — Zones + Vehicles** — 9 ops (`admin.zones.*` ×4, `admin.vehicles.*` ×5)
- [x] **Batch 2 — Pricing Rules** — 6 ops (`admin.pricing.{list,read,create,update,delete,match}`)
- [x] **Batch 3 — Routes + Stops** — 7 ops (`admin.routes.{list,read,create,update,delete,stopsList,stopsReplace}`)
- [x] **Batch 4 — Rider Management** — 5 ops (`admin.riders.{list,read,create,update,setStatus}`)
- [ ] **Batch 5 — Rider Location Tracking** — 0 of 2 ops. Not started. Unblocked: Batch 4 landed.
- [ ] **Batch 6 — Pickup Operations** — 0 of 5 ops. Not started.
- [ ] **Batch 7 — Transfer Operations** — 0 of 8 ops. Not started.
- [ ] **Batch 8 — Delivery Management** — 0 of 5 ops. Not started.
- [ ] **Batch 9 — Delivery Proof** — 0 of 4 ops. Not started.

**Remaining: 5 batches, 24 ops, 9 admin screens.**

Rider-facing gaps, for contrast: the rider app (`apps/riders`) has only Jobs and Profile
(`bottom-nav.tsx`), backed by 3 ops (`job.list`, `job.read`, `job.reportOutcome`). The two rider-app
features still missing are Batch 5 (location push) and Batch 9 (proof submission) — rider
_management_ is admin-side by design and does not belong in the rider app.

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

**Status: NOT STARTED.** Blocked on Batch 4 (needs the riders it locates).

| File                                                        | Action                                |
| ----------------------------------------------------------- | ------------------------------------- |
| `apps/api/src/modules/riders/rider-locations.repository.ts` | **new**                               |
| `apps/api/src/modules/riders/rider-locations.service.ts`    | **new**                               |
| `apps/api/src/modules/admin/registry.ts`                    | **edit**                              |
| `apps/api/src/modules/admin/handlers.ts`                    | **edit**                              |
| `apps/api/src/modules/jobs/jobs.routes.ts`                  | **edit** — add `POST /jobs/locations` |
| `apps/admin/src/features/riders/rider-locations-page.tsx`   | **new**                               |
| `apps/admin/src/routes/rider-locations.tsx`                 | **new**                               |
| `apps/riders/src/features/jobs/location-push.ts`            | **new**                               |
| `apps/riders/src/lib/api.ts`                                | **edit**                              |

---

## Batch 6 — Pickup Operations (5 ops)

**Status: NOT STARTED.** Dependencies met (parcels + riders tables exist).

| File                                                      | Action   |
| --------------------------------------------------------- | -------- |
| `apps/api/src/modules/pickups/pickups.dto.ts`             | **new**  |
| `apps/api/src/modules/pickups/pickups.repository.ts`      | **new**  |
| `apps/api/src/modules/pickups/pickups.service.ts`         | **new**  |
| `apps/api/src/modules/admin/registry.ts`                  | **edit** |
| `apps/api/src/modules/admin/handlers.ts`                  | **edit** |
| `apps/admin/src/features/pickups/pickups-list-page.tsx`   | **new**  |
| `apps/admin/src/features/pickups/pickup-assign-sheet.tsx` | **new**  |
| `apps/admin/src/routes/pickups.tsx`                       | **new**  |
| `apps/admin/src/lib/endpoints.ts`                         | **edit** |
| `apps/admin/src/lib/types.ts`                             | **edit** |
| `apps/admin/src/lib/navigation.ts`                        | **edit** |

---

## Batch 7 — Transfer Operations (8 ops)

**Status: NOT STARTED.** Dependencies met (hubs + routes + vehicles exist). Routes came from
Batch 3, so this is the first real consumer of that batch.

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
| 5         | Rider Locations  | 2           | 1                 | ~6            | **not started**       |
| 6         | Pickups          | 5           | 2                 | ~8            | **not started**       |
| 7         | Transfers        | 8           | 3                 | ~10           | **not started**       |
| 8         | Deliveries       | 5           | 2                 | ~8            | **not started**       |
| 9         | Delivery Proofs  | 4           | 1                 | ~7            | **not started**       |
| **Total** | **10 features**  | **51 ops**  | **19 screens**    | **~75 files** | **27 of 51 ops done** |

Ops actually shipped: 9 + 6 + 7 + 5 = **27**, against 51 planned. The API registered **65**
operations at last boot; the other 38 predate the P0 plan (auth, health, tracking, parcels, jobs,
customer).

Two batches came in one op short, both deliberately: Batch 3 folded stop add/remove into a single
`PUT`, and Batch 4 has no delete because a rider owns delivery history and is suspended instead. See
those batches' status notes.
