# DropX — Remaining Features

Verified against codebase. Built = has real implementation. Missing = table/key exists but zero code.

---

## Organization & People
> Priority - 1

- [ ] **Staff user management** — create/edit users, reset passwords, activate/deactivate, assign roles, hub scoping via `user_hubs`
- [ ] **Role permission matrix** — visual editor to grant/revoke the 48 static permission keys per role
- [ ] **Customer management** — list, detail with addresses and parcel history, TEMP→ACTIVE activation

## Network & Pricing
> Priority - 0

- [ ] **Zone management** — CRUD for geographic pricing areas (read-only reference endpoint exists)
- [ ] **Pricing rules CRUD** — create/update zone-pair and weight-band pricing (only `pricing.quote` read exists)
- [ ] **Vehicle management** — register bikes/vans/trucks, capacity, availability tracking
- [ ] **Route & stop management** — hub-to-hub routes with ordered stops, distance, ETA

## Fleet & Riders
> Priority - 0
- [ ] **Rider management** — rider profiles linked to users, home hub, compensation type, status
- [ ] **Rider location tracking** — push and store live rider locations (`rider_locations` table, `rider.location.update` key — nothing built)

## Operations Execution
> Priority - 0

- [ ] **Pickup operations** — assign riders to pickups, pickup status tracking (table + 3 permission keys exist, zero code)
- [ ] **Transfer operations** — load/unload manifests, hub-to-hub transfers with staff drivers (tables + 2 keys exist, zero code)
- [ ] **Delivery management** — view attempts, reassign riders, enforce one open attempt at a time (admin side exists only via rider job reporting)
- [ ] **Delivery proof submission** — rider submits signature/photo/OTP proof (`rider.proof.submit` key exists, `proof-placeholder.tsx` is a stub, no API)

## Money & Support
> Priority - 1
- [ ] **Payments & COD** — record COD remittances, refunds, payment tracking (table + 2 keys exist, zero code)
- [ ] **Settlements** — period payouts to customers, PENDING→PAID workflow (table + 2 keys exist, zero code)
- [ ] **Support tickets** — list, assign to staff, resolve (table + 2 keys exist, zero code)
- [ ] **Notifications** — outbox viewer with retry for SMS/email/push (table + 1 key exist, zero code; event bus emits but has no handlers)

## Oversight
> Priority - 2

- [ ] **Dashboard KPIs** — replace getting-started screen with real metrics (parcels by status, COD outstanding, unsettled balance)
- [ ] **Audit logging** — write `audit_logs` on every staff mutation (table + key exist, zero code; sidebar already claims this works)

## Cross-Cutting
> Priority - 3
- [ ] **Test suite** — vitest + service-level tests (zero test files in the entire repo)
- [ ] **Browser E2E** — verify sheets, pickers, and role-based 403s in a real browser with a live database
