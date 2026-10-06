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

- [x] **Zone management** — CRUD for geographic pricing areas (read-only reference endpoint exists)
- [ ] **Pricing rules CRUD** — create/update zone-pair and weight-band pricing (only `pricing.quote` read exists)
- [x] **Vehicle management** — register bikes/vans/trucks, capacity, availability tracking
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

- [x] **Payments & COD** — record COD remittances, refunds, payment tracking. Batch 4 shipped **cash-only** under `/admin/payments` (list/read/record/refund); digital methods and the PENDING lifecycle are deferred to the P2 group below.
- [ ] **Settlements** — period payouts to customers, PENDING→PAID workflow (table + 2 keys exist, zero code)
- [ ] **Support tickets** — list, assign to staff, resolve (table + 2 keys exist, zero code)
- [ ] **Notifications** — outbox viewer with retry for SMS/email/push (table + 1 key exist, zero code; event bus emits but has no handlers)

## Online payments (deferred from P1)

> Priority - 2

- [ ] **Digital methods on COD settlement** — `POST /admin/payments` hardcodes `CASH` today; accept BKASH/NAGAD/CARD/BANK/ONLINE.
- [ ] **PENDING lifecycle** — nothing in batch 4 creates a `PENDING` row; add a digital path that does and advances it PAID/FAILED on gateway confirmation (`PAYMENT_TRANSITIONS`/`canTransitionPayment` in `packages/types` are declared but not yet exercised).
- [ ] **Gateway integration** — provider adapter behind an interface, webhook-as-source-of-truth for PAID/FAILED, reconciliation of failed webhooks.
- [ ] **Pay-at-booking for customers** — online payment in the web portal at parcel creation (`PAYMENT_KINDS` already includes `DELIVERY_FEE`).
- [ ] **Payment reference field** — the `payments` table has no `transaction_reference`; add a schema + `migrate.sql` change (first money-table migration since Batch 4 shipped).

## Oversight

> Priority - 2

- [ ] **Dashboard KPIs** — replace getting-started screen with real metrics (parcels by status, COD outstanding, unsettled balance)
- [ ] **Audit logging** — write `audit_logs` on every staff mutation (table + key exist, zero code; sidebar already claims this works)

## Cross-Cutting

> Priority - 3

- [ ] **Test suite** — vitest + service-level tests (zero test files in the entire repo)
- [ ] **Browser E2E** — verify sheets, pickers, and role-based 403s in a real browser with a live database
