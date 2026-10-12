# Milestone 2 — Professional Product Plan

**Status:** Draft for review  
**Updated:** 2026-10-12  
**Purpose:** One clear plan showing what DropX already has, what is missing, and what M2 must deliver.

> M2 includes all unfinished work carried forward from P0, P1, `handoff.md`,
> `remaining-features.md`, and the older admin plan. Completed features are not planned again.

## 1. Current position

### What DropX already has

| Area             | Working capability                                                         |
| ---------------- | -------------------------------------------------------------------------- |
| Parcel lifecycle | Booking, pickup, hub transfer, delivery attempts, delivery proof, tracking |
| Network          | Branches, hubs, zones, pricing, vehicles, routes, route stops              |
| People           | Staff users, roles, permission matrix, customers, riders, rider locations  |
| Operations       | Rider assignment, pickup status, transfer manifests, delivery reassignment |
| Basic finance    | Cash COD records, cash refunds, merchant settlement totals and statuses    |

### What is still missing

| Gap                                         | Why a professional product needs it                                                                           | M2 priority |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| Automated regression coverage is incomplete | The authenticated core lifecycle was manually tested and works, but future changes could regress it unnoticed | **First**   |
| No real hub/company dashboard               | Staff cannot see backlog, aging, exceptions, or workload in one place                                         | **High**    |
| COD custody is incomplete                   | The system does not clearly track cash from rider to hub/company                                              | **High**    |
| Rider compensation is incomplete            | Only compensation type exists; no earnings, statement, approval, or payout                                    | **High**    |
| Financial controls are incomplete           | No immutable statement lines, complete audit trail, or reconciliation queues                                  | **High**    |

## 2. Keep these money flows separate

| Flow                | Direction               | Gateway?            |
| ------------------- | ----------------------- | ------------------- |
| Delivery charge     | Customer/sender → DropX | **Yes, optionally** |
| COD collection      | Receiver → rider        | No                  |
| COD remittance      | Rider → DropX           | No                  |
| Merchant settlement | DropX → merchant/sender | No checkout gateway |
| Rider compensation  | DropX → rider           | No checkout gateway |

### Non-negotiable rules

1. The payment gateway collects the **delivery charge only**.
2. COD/product value must never be sent to customer gateway checkout.
3. Rider COD custody and rider earnings are different balances.
4. The API calculates every trusted amount; the frontend cannot submit a trusted total.
5. Paid financial records are not edited. Corrections use refunds, reversals, or adjustments.

## 3. M2 delivery plan

### Step 1 — Finish and protect the current product

**What exists:** Core P0 features and P1 Batches 1–5 are implemented. The authenticated lifecycle
has been manually tested and works.

**Gaps to close:**

1. Build support ticket create, assign, resolve, reopen, and close flows.
2. Build notification outbox, event writer, retry flow, and clear delivery status.
3. Convert the working manual lifecycle check into repeatable browser E2E coverage.
4. Verify admin-created rider login, rider jobs, location updates, and proof submission.
5. Close known sort, role-seed, credential, lint-policy, and API-version decisions.

**Professional done condition:**

- The completed manual checks are documented with the roles and flows that were exercised.
- Scope and permission failures return the correct 403/404 behavior.
- Old documents no longer report implemented features as missing.
- Critical business flows have service tests and browser E2E coverage.

**Rough effort:** 2–4 weeks for one full-time engineer, depending on notification provider work and
the number of defects found during E2E testing.

---

### Step 2 — Build company and hub dashboards

**What exists:** The current admin dashboard shows account/scope information and one parcel count.

**Gap:** It does not show real operational workload or exceptions.

#### Company dashboard

- Parcels by lifecycle status.
- Delivery and first-attempt success rates.
- Aging parcels and SLA exceptions.
- COD held, remitted, unsettled, and disputed.
- Hub comparison for backlog, throughput, and failures.

#### Hub dashboard

- Pickups awaiting assignment or overdue.
- Inbound/outbound transfers requiring action.
- Parcels at the hub grouped by aging.
- Delivery attempts due, failed, or awaiting assignment.
- Rider availability and COD awaiting handover.

**Professional standard:**

- Every number has a documented definition.
- Every actionable card opens the matching filtered list.
- Auth scope decides which hubs are visible; a URL parameter can never widen scope.
- Dashboard queries are tested using production-sized data.

**Rough effort:** 3–5 weeks for APIs, UI, drill-downs, scope tests, and performance work.

---

### Step 3 — Track rider COD custody and merchant settlements

**What exists:** Finance can manually record cash COD and create aggregate merchant settlements.

**Gap:** The system cannot fully explain which rider handed over which parcel's COD, or which parcel
lines created a merchant settlement total.

#### Rider COD handover

- Rider sees COD currently in their custody.
- Hub creates a handover/remittance batch.
- Expected amount is calculated from eligible delivered parcels.
- Hub records received amount and confirms or disputes the difference.
- Each parcel can belong to only one confirmed remittance batch.

#### Merchant settlement

- Only confirmed/remitted COD becomes eligible.
- Settlement contains immutable parcel-level lines.
- Each line shows COD, delivery-charge deduction, refund, adjustment, and net amount.
- A line can be settled only once.
- Paid settlements are immutable and include payout method/reference.

```text
merchant payable
= confirmed COD remitted
- delivery charges owed by the merchant
- refunds and reversals
+/- approved adjustments
```

An online delivery charge already paid by the sender must not be deducted again.

**Professional standard:**

- Header totals always equal line totals.
- Differences require a reason and, above a configured amount, a second approver.
- Concurrent confirmations cannot remit or settle the same parcel twice.
- Finance can trace every balance back to parcels and actors.

**Rough effort:** 5–8 weeks for custody, statements, concurrency controls, exports, and E2E tests.

---

### Step 4 — Build rider earnings and payouts

**What exists:** Riders have one compensation type: salaried, contractual, commission, or mixed.

**Gap:** There is no earning calculation, statement, approval, or payout history.

#### Rider experience

- Current estimated earnings.
- Completed-job earning lines.
- Bonuses, penalties, and adjustments with reasons.
- Pay-period statements.
- Payout status, method, reference, and paid date.
- COD custody shown separately from earnings.

#### Finance experience

- Configure effective-dated earning rules.
- Preview and review a rider pay period.
- Add controlled manual adjustments.
- Approve and mark payouts processing, paid, or failed.
- Export rider statements and reconcile payout references.

```text
rider payable
= salary or contract amount
+ pickup/delivery commission
+ bonuses
- penalties or advances
+/- approved adjustments
```

**Professional standard:**

- A completed job creates at most one normal earning line.
- Changing a rule does not rewrite historical earnings.
- The adjustment creator cannot approve the same high-risk adjustment.
- COD is never silently subtracted from rider earnings.

**Rough effort:** 4–7 weeks after earning rules are approved by the business.

---

### Step 5 — Add delivery-charge gateway and finance reconciliation

**What exists:** Delivery charges and cash payment records exist, but no gateway is connected.

**Gap:** Customers cannot pay the delivery charge online, and finance lacks one reconciliation view.

#### Gateway scope

1. API calculates the delivery charge from pricing rules.
2. Customer chooses cash or online delivery-charge payment.
3. API creates an idempotent payment intent for exactly that amount.
4. Provider checkout collects only the delivery charge.
5. A signed webhook confirms paid or failed status.

#### Required controls

- Provider adapter so business logic does not depend directly on one gateway.
- Unique idempotency and provider transaction references.
- Signed webhook verification and replay protection.
- Webhook is the source of truth, not the browser redirect.
- Refund and failed-webhook reconciliation.

#### Finance dashboard

- Delivery charges: pending, paid, failed, and refunded.
- COD: held, submitted, confirmed, disputed, and unsettled.
- Merchant settlements: pending, paid, and failed.
- Rider payouts: draft, approved, paid, and failed.
- Missing references, unmatched transactions, and differences needing action.

**Professional standard:**

- A modified frontend amount cannot change the provider amount.
- Duplicate requests or webhooks create one financial result.
- Every difference has an owner, reason, status, and age.
- Finance can reproduce opening balance + movements = closing balance.

**Rough effort:** 5–8 weeks for one provider, sandbox certification, refunds, and reconciliation.

## 4. Professional-product requirements

These apply to every M2 step.

### Financial integrity

- Immutable statement and earning lines.
- Idempotent money operations.
- Unique external references.
- Explicit refunds, reversals, and adjustments.
- Server-calculated totals.

### Security and control

- Static permission keys enforced by the API.
- Branch/hub scope enforced in every read and write.
- Audit log for every staff mutation.
- Dual approval for high-risk finance actions.
- No secrets, tokens, OTPs, or passwords in logs/audit data.

### Reliability

- Durable background jobs for notifications and webhooks.
- Bounded retries and visible terminal failures.
- Structured logs and correlation IDs.
- Monitoring for queue backlog and financial mismatch.
- Tested database backup and restore.

### Testing

- Service tests for state transitions and calculations.
- Scope tests for company, branch, hub, finance, and rider users.
- Concurrency tests for remittance, settlement, payout, and webhooks.
- Browser E2E for the full parcel and money lifecycle.
- Provider sandbox contract tests.

## 5. Build order

| Order | Deliverable                              | Start only when                            |
| ----- | ---------------------------------------- | ------------------------------------------ |
| 1     | Current product closeout                 | Start now                                  |
| 2     | Company + hub dashboards                 | KPI definitions are approved               |
| 3     | COD custody + merchant settlement lines  | Financial line-item model is approved      |
| 4     | Rider earnings + payouts                 | Compensation rules are approved            |
| 5     | Delivery-charge gateway + reconciliation | Provider and booking behavior are approved |

With one full-time engineer, this is roughly **5–8 months** including testing and stabilization.
Parallel frontend/backend work can shorten calendar time, but finance decisions and E2E certification
remain sequential gates.

## 6. M2 is complete when

1. A hub operator can see and act on only their hub's workload and exceptions.
2. Rider COD moves from delivery → rider custody → confirmed company handover.
3. Confirmed COD becomes one explainable merchant settlement line and is paid once.
4. Rider jobs produce explainable earnings and one approved payout statement.
5. Customer gateway checkout collects only the server-calculated delivery charge.

The milestone also requires green scope, calculation, concurrency, provider, and browser E2E tests;
complete audit history; working monitoring; and tested backup/restore.

## 7. Decisions to approve before implementation

1. Who pays the delivery charge: sender, receiver, merchant deduction, or configurable?
2. Does online payment use a pending parcel or a temporary booking draft?
3. When does COD enter rider custody: delivery status, verified proof, or both?
4. How is rider commission calculated: job, distance, zone, weight, shift, or mixed?
5. Which amount requires a second finance approver?

## 8. Not included in M2

- Sending COD/product value through customer gateway checkout.
- Customer or merchant stored-value wallets.
- Rider lending or cash advances as a financial product.
- Full general-ledger accounting or automatic tax filing.
- Multi-company/multi-tenant accounting.
