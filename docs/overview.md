# DropX — System Overview

DropX is a **single-tenant** parcel delivery and logistics management platform for one courier company. It covers the full parcel lifecycle: creation, pickup, hub processing, inter-hub transfer, last-mile delivery, COD/payments, settlements, and customer support.

---

## Apps

```text
apps/
  web/       # Customer portal
  riders/    # Rider app
  console/   # Admin / ops console
  api/       # Backend API
```

| App | Audience | Login |
|-----|----------|-------|
| `apps/web` | Customers (senders / receivers) | **OTP** via phone or email |
| `apps/riders` | Pickup / delivery riders | Email + password (`users`) |
| `apps/console` | Admins, branch staff, hub operators, dispatchers, support, finance | Email + password (`users`) + RBAC |
| `apps/api` | All clients | Validates sessions/tokens; enforces permissions and data scope |

Branches and hubs are **not** separate apps. Their staff use `apps/console` with role- and branch/hub-scoped access. See [`rbac.md`](./rbac.md).

---

## Login flows

### Customer OTP (`apps/web`)

1. Customer enters phone or email.
2. API sends a one-time code (SMS or email).
3. Customer verifies OTP and receives a customer session.
4. Identity maps to a `customers` row by phone or email.

No password. Customers are outside staff RBAC; they only see their own parcels, addresses, and tickets.

### Staff (`apps/console`)

Email + `password_hash` on `users`, plus roles → `role_permissions`. Permission keys are static in code.

### Rider (`apps/riders`)

Same password login as staff. Each rider has `riders.user_id` → `users` and the `RIDER` role (`rider.*` keys only).

---

## Organization

- **Branches** — regional offices; managed in console by admin (or limited branch managers).
- **Hubs** — origin / sorting / transit / destination nodes under a branch; day-to-day ops in console.
- **Users** — staff and riders; optional `branch_id`; roles and permission keys.
- **Riders** — operational profile + home hub; location history in `rider_locations`.

---

## Customers

- Individual or business; phone required, email optional.
- Multiple addresses.
- After OTP login: track parcels, manage addresses, open tickets, receive notifications.

---

## Zones & Pricing

- **Zones** — geographic pricing areas.
- **Pricing rules** — origin/destination zone, weight band, base/per-kg, COD fees, express fee.

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

1. **Create** — sender/receiver, hubs, weight, prepaid or COD.
2. **Pickup** — assign rider; track pickup status.
3. **Transfer** — load onto hub-to-hub transfer (vehicle, route, driver).
4. **Delivery** — last-mile from destination hub; proof (signature, photo, OTP, identity).
5. **Events** — `parcel_events` for full tracking history.

Parcels are the center of the model: items, pickups, transfers, deliveries, payments, notifications, and tickets link to them.

---

## Payments & Settlements

- **Payments** — delivery fee, COD, refunds (cash, bKash, Nagad, card, bank, online).
- **Settlements** — period payouts to customers (especially business COD).

---

## Notifications & Support

- SMS / email / push about parcel events.
- Support tickets for a customer (optional parcel), assignable to staff in console.

---

## Security

- Staff RBAC: `roles` → `user_roles` → users; `role_permissions` stores static `permission_key` values.
- Customer access: OTP session + own-data filters only.
- Rider access: own assigned jobs + location/proof APIs.
- Audit: `audit_logs` for staff actions.

Full matrix: [`rbac.md`](./rbac.md).

---

## Tech notes

- Database: MySQL 8.0+
- Schema: [`migrate.sql`](../migrate.sql)
- ER diagram: [`er-diagram.md`](./er-diagram.md)
- Agent guide: [`AGENTS.md`](../AGENTS.md)
