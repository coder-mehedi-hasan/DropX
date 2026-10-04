# P0 Implementation Plan

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

### Zones CRUD (4 ops: list, read, create, update)

| File | Action |
|---|---|
| `apps/api/src/modules/zones/zones.dto.ts` | **new** |
| `apps/api/src/modules/zones/zones.repository.ts` | **new** |
| `apps/api/src/modules/zones/zones.service.ts` | **new** |
| `apps/api/src/modules/admin/registry.ts` | **edit** — add `zones` feature |
| `apps/api/src/modules/admin/handlers.ts` | **edit** |
| `apps/admin/src/features/zones/zones-list-page.tsx` | **new** |
| `apps/admin/src/features/zones/zone-form-sheet.tsx` | **new** |
| `apps/admin/src/routes/zones.tsx` | **new** |
| `apps/admin/src/lib/endpoints.ts` | **edit** |
| `apps/admin/src/lib/types.ts` | **edit** |
| `apps/admin/src/lib/navigation.ts` | **edit** |

### Vehicles CRUD (5 ops: list, read, create, update, deactivate)

Same file pattern as zones.

---

## Batch 2 — Pricing Rules CRUD (6 ops)

| File | Action |
|---|---|
| `apps/api/src/modules/pricing/pricing-rules.dto.ts` | **new** |
| `apps/api/src/modules/pricing/pricing-rules.repository.ts` | **new** |
| `apps/api/src/modules/pricing/pricing-rules.service.ts` | **new** |
| `apps/api/src/modules/admin/registry.ts` | **edit** |
| `apps/api/src/modules/admin/handlers.ts` | **edit** |
| `apps/admin/src/features/pricing/pricing-rules-list-page.tsx` | **new** |
| `apps/admin/src/features/pricing/pricing-rule-form-sheet.tsx` | **new** |
| `apps/admin/src/routes/pricing-rules.tsx` | **new** |
| `apps/admin/src/lib/endpoints.ts` | **edit** |
| `apps/admin/src/lib/types.ts` | **edit** |
| `apps/admin/src/lib/navigation.ts` | **edit** |

---

## Batch 3 — Routes + Stops (8 ops)

| File | Action |
|---|---|
| `apps/api/src/modules/routes/routes.dto.ts` | **new** |
| `apps/api/src/modules/routes/routes.repository.ts` | **new** |
| `apps/api/src/modules/routes/routes.service.ts` | **new** |
| `apps/api/src/modules/admin/registry.ts` | **edit** |
| `apps/api/src/modules/admin/handlers.ts` | **edit** |
| `apps/admin/src/features/routes/routes-list-page.tsx` | **new** |
| `apps/admin/src/features/routes/route-form-sheet.tsx` | **new** |
| `apps/admin/src/routes/routes.tsx` | **new** |
| `apps/admin/src/lib/endpoints.ts` | **edit** |
| `apps/admin/src/lib/types.ts` | **edit** |
| `apps/admin/src/lib/navigation.ts` | **edit** |

---

## Batch 4 — Rider Management (6 ops)

| File | Action |
|---|---|
| `apps/api/src/modules/riders/riders.dto.ts` | **new** |
| `apps/api/src/modules/riders/riders.repository.ts` | **new** |
| `apps/api/src/modules/riders/riders.service.ts` | **new** |
| `apps/api/src/modules/admin/registry.ts` | **edit** |
| `apps/api/src/modules/admin/handlers.ts` | **edit** |
| `apps/admin/src/features/riders/riders-list-page.tsx` | **new** |
| `apps/admin/src/features/riders/rider-form-sheet.tsx` | **new** |
| `apps/admin/src/routes/riders.tsx` | **new** |
| `apps/admin/src/lib/endpoints.ts` | **edit** |
| `apps/admin/src/lib/types.ts` | **edit** |
| `apps/admin/src/lib/navigation.ts` | **edit** |

---

## Batch 5 — Rider Location Tracking (2 ops)

| File | Action |
|---|---|
| `apps/api/src/modules/riders/rider-locations.repository.ts` | **new** |
| `apps/api/src/modules/riders/rider-locations.service.ts` | **new** |
| `apps/api/src/modules/admin/registry.ts` | **edit** |
| `apps/api/src/modules/admin/handlers.ts` | **edit** |
| `apps/api/src/modules/jobs/jobs.routes.ts` | **edit** — add `POST /jobs/locations` |
| `apps/admin/src/features/riders/rider-locations-page.tsx` | **new** |
| `apps/admin/src/routes/rider-locations.tsx` | **new** |
| `apps/riders/src/features/jobs/location-push.ts` | **new** |
| `apps/riders/src/lib/api.ts` | **edit** |

---

## Batch 6 — Pickup Operations (5 ops)

| File | Action |
|---|---|
| `apps/api/src/modules/pickups/pickups.dto.ts` | **new** |
| `apps/api/src/modules/pickups/pickups.repository.ts` | **new** |
| `apps/api/src/modules/pickups/pickups.service.ts` | **new** |
| `apps/api/src/modules/admin/registry.ts` | **edit** |
| `apps/api/src/modules/admin/handlers.ts` | **edit** |
| `apps/admin/src/features/pickups/pickups-list-page.tsx` | **new** |
| `apps/admin/src/features/pickups/pickup-assign-sheet.tsx` | **new** |
| `apps/admin/src/routes/pickups.tsx` | **new** |
| `apps/admin/src/lib/endpoints.ts` | **edit** |
| `apps/admin/src/lib/types.ts` | **edit** |
| `apps/admin/src/lib/navigation.ts` | **edit** |

---

## Batch 7 — Transfer Operations (8 ops)

| File | Action |
|---|---|
| `apps/api/src/modules/transfers/transfers.dto.ts` | **new** |
| `apps/api/src/modules/transfers/transfers.repository.ts` | **new** |
| `apps/api/src/modules/transfers/transfers.service.ts` | **new** |
| `apps/api/src/modules/admin/registry.ts` | **edit** |
| `apps/api/src/modules/admin/handlers.ts` | **edit** |
| `apps/admin/src/features/transfers/transfers-list-page.tsx` | **new** |
| `apps/admin/src/features/transfers/transfer-form-sheet.tsx` | **new** |
| `apps/admin/src/features/transfers/transfer-manifest-sheet.tsx` | **new** |
| `apps/admin/src/routes/transfers.tsx` | **new** |
| `apps/admin/src/lib/endpoints.ts` | **edit** |
| `apps/admin/src/lib/types.ts` | **edit** |
| `apps/admin/src/lib/navigation.ts` | **edit** |

---

## Batch 8 — Delivery Management (5 ops)

| File | Action |
|---|---|
| `apps/api/src/modules/deliveries/deliveries.dto.ts` | **new** |
| `apps/api/src/modules/deliveries/deliveries.repository.ts` | **new** |
| `apps/api/src/modules/deliveries/deliveries.service.ts` | **new** |
| `apps/api/src/modules/admin/registry.ts` | **edit** |
| `apps/api/src/modules/admin/handlers.ts` | **edit** |
| `apps/admin/src/features/deliveries/deliveries-list-page.tsx` | **new** |
| `apps/admin/src/features/deliveries/delivery-assign-sheet.tsx` | **new** |
| `apps/admin/src/routes/deliveries.tsx` | **new** |
| `apps/admin/src/lib/endpoints.ts` | **edit** |
| `apps/admin/src/lib/types.ts` | **edit** |
| `apps/admin/src/lib/navigation.ts` | **edit** |

---

## Batch 9 — Delivery Proof Submission (4 ops)

| File | Action |
|---|---|
| `apps/api/src/modules/deliveries/delivery-proofs.repository.ts` | **new** |
| `apps/api/src/modules/deliveries/delivery-proofs.service.ts` | **new** |
| `apps/api/src/modules/admin/registry.ts` | **edit** |
| `apps/api/src/modules/admin/handlers.ts` | **edit** |
| `apps/api/src/modules/jobs/jobs.routes.ts` | **edit** — add `POST /jobs/proofs` |
| `apps/admin/src/features/deliveries/delivery-proofs-list-page.tsx` | **new** |
| `apps/admin/src/routes/delivery-proofs.tsx` | **new** |
| `apps/riders/src/features/jobs/delivery-proof-sheet.tsx` | **new** |
| `apps/riders/src/lib/api.ts` | **edit** |

---

## Gate (after each batch)

```bash
bun run typecheck
bun run --cwd apps/api check:read-paths   # needs db:migrate
bun run lint
```

---

## Summary

| Batch | Features | New API Ops | New Admin Screens | New Files |
|---|---|---|---|---|
| 1 | Zones, Vehicles | 9 | 4 | ~12 |
| 2 | Pricing Rules | 6 | 2 | ~8 |
| 3 | Routes + Stops | 8 | 2 | ~8 |
| 4 | Rider Management | 6 | 2 | ~8 |
| 5 | Rider Locations | 2 | 1 | ~6 |
| 6 | Pickups | 5 | 2 | ~8 |
| 7 | Transfers | 8 | 3 | ~10 |
| 8 | Deliveries | 5 | 2 | ~8 |
| 9 | Delivery Proofs | 4 | 1 | ~7 |
| **Total** | **10 features** | **53 ops** | **19 screens** | **~75 files** |
