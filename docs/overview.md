# DropX — System Overview

DropX is a **single-tenant** parcel delivery and logistics management platform for one courier company. It covers the full parcel lifecycle: creation, pickup, hub processing, inter-hub transfer, last-mile delivery, COD/payments, settlements, and customer support.

---

## Portals & Login

| Portal | Who | How they log in |
|--------|-----|-----------------|
| **Admin / Ops console** | Staff users (admin, hub operators, dispatchers, support) | Email + password via `users` |
| **Rider app** | Delivery / pickup riders | Email + password via `users` (each rider is linked 1:1 to a user) |
| **Customer portal** | Senders and receivers | **OTP** sent to **phone or email** — no password |

### Customer OTP login

1. Customer enters phone or email.
2. System sends a one-time code (SMS or email).
3. Customer verifies the OTP and gets a session for the customer portal.
4. Identity is matched to a `customers` row by phone or email.

OTP codes are short-lived and not stored as long-term credentials. Permission keys for staff stay in application code; only role → key assignments are stored (`role_permissions`).

### Rider login

Riders are employees: create a `users` account, assign a rider role, then create a `riders` row with that `user_id`. They use the same password login as staff, with access limited to rider features.

---

## Organization

- **Branches** — regional offices of the company.
- **Hubs** — origin, sorting, transit, or destination nodes under a branch.
- **Users** — staff and riders, scoped optionally to a branch, with roles and permission keys.
- **Riders** — operational profile tied to a user and home hub; live location history is stored separately.

---

## Customers

- Individuals or businesses, identified primarily by **phone** (email optional).
- Multiple saved addresses.
- Can track parcels, manage addresses, open support tickets, and receive notifications after OTP login.

---

## Zones & Pricing

- **Zones** define geographic pricing areas.
- **Pricing rules** set fees by origin/destination zone, weight band, COD surcharge, and express fee.

---

## Vehicles & Routes

- **Vehicles** (bike, van, truck, etc.) used on transfers.
- **Routes** connect hubs, with ordered **route stops** for multi-hub paths.

---

## Parcel lifecycle

```text
CREATED → PICKED_UP → IN_TRANSIT / AT_HUB → OUT_FOR_DELIVERY → DELIVERED
                                                                    ↘ FAILED / CANCELLED / RETURNED
```

1. **Create** — sender/receiver customers, origin & destination hubs, weight, COD or prepaid.
2. **Pickup** — request assigned to a rider; status tracked through pickup.
3. **Transfer** — parcel loaded onto a hub-to-hub transfer (vehicle, route, driver).
4. **Delivery** — last-mile assignment from destination hub to a rider; proof of delivery (signature, photo, OTP, identity).
5. **Events** — every meaningful status change is recorded in `parcel_events` for tracking history.

Parcels remain the hub of the model: items, pickups, transfers, deliveries, payments, notifications, and tickets all hang off them.

---

## Payments & Settlements

- **Payments** — delivery fee, COD, refunds (cash, bKash, Nagad, card, bank, online).
- **Settlements** — periodic payouts to customers (especially business COD), with net amount and status.

---

## Notifications & Support

- SMS, email, or push notifications to users or customers about parcel events.
- Support tickets linked to a customer and optionally a parcel, assignable to staff.

---

## Security & audit

- **RBAC** — `roles` → `user_roles` → users; `role_permissions` stores static `permission_key` strings defined in the app.
- **Audit logs** — who did what, on which entity, with optional before/after JSON.

---

## Tech notes

- Database: MySQL 8.0+
- Schema: [`migrate.sql`](../migrate.sql)
- ER diagram: [`er-diagram.md`](./er-diagram.md)
