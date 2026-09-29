# Admin & Ops Portal — Feature Plan

**Written:** 2026-09-30, from an inventory of `apps/admin`, `apps/api/src/modules`, `migrate.sql`, and `docs/`.
**Status:** plan only. Nothing in it is implemented.
**Companion docs:** [`overview.md`](./overview.md) (product), [`rbac.md`](./rbac.md) (roles & permission keys), [`er-diagram.md`](./er-diagram.md) (schema), [`handoff.md`](./handoff.md) (point-in-time session notes).

> This document does **not** restate the architecture rules in [`AGENTS.md`](../AGENTS.md). Read that first — it is authoritative for layout, commands, API conventions, and the "adding an operation" contract. Everything below assumes it.

## Decisions already taken

| Decision                                   | Choice                                                                                          | Section |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------- |
| Order of work                              | **registry (A1) first, then the namespace split (A2)** — otherwise the spec churn happens twice | §3      |
| How the admin surface is namespaced        | `/api/v1/admin/*` mount + `admin.` id prefix                                                    | §3.3    |
| What happens to the mixed `parcels` module | split — admin and customer get own namespaces                                                   | §3.5    |
| Layout under the new namespace             | `modules/admin/` with `registry.ts` + `handlers.ts` — surface-first, one place for contracts    | §3.3    |
| Where shared logic lives                   | `modules/{domain}/*.service.ts` + `*.repository.ts` stay put; only the contract is per surface  | §3.3    |
| Registry scope                             | **admin surface only, proved on 5 operations** — extend once it works                           | §3.2    |
| Riders                                     | out of scope for this change                                                                    | §3.8    |

Still open: whether any external system calls this API today, which decides in-place vs `/api/v2` (§3.7); the reference-data shape (§6); and where the generated OpenAPI is written (§3.7, default proposed: in memory, served at `/openapi.json`).

---

## 1. Where the admin stands today

| Dimension       | Built                                                                                                                                                                                | Missing                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Admin screens   | 5 — login, dashboard, parcels list, parcel detail, tracking                                                                                                                          | ~20 more                                     |
| Nav items       | 3 — Dashboard, Parcels, Tracking                                                                                                                                                     | ~14 more                                     |
| API modules     | 6 — health, auth, tracking, parcels, jobs, pricing. 22 operations, all documented, zero OpenAPI drift                                                                                | ~23 modules                                  |
| DB tables wired | 13 of 29 (`customers`, `deliveries`, `hubs`, `parcel_events`, `parcel_items`, `parcels`, `pricing_rules`, `riders`, `role_permissions`, `roles`, `user_hubs`, `user_roles`, `users`) | 16 tables have no API **and** no UI anywhere |
| Permissions     | 40 keys declared, 7 roles seeded, **6 enforced** (`parcels.view/create/update/cancel`, `rider.jobs.view/update`)                                                                     | 34 keys gate nothing                         |
| Tests           | Zero test files. No test runner in any `package.json`                                                                                                                                | whole layer                                  |

**The hard truth:** admin can create, list, inspect, and cancel a parcel. That is the entire surface. Pickup, transfer, delivery assignment, payment, settlement, and support exist in `migrate.sql` and in `docs/overview.md:101-114`, but in neither the API nor the UI. Every admin screen past the parcels list is unbuilt.

### Screens that exist

| Route                | File                                      | Guard          | Reads                                  |
| -------------------- | ----------------------------------------- | -------------- | -------------------------------------- |
| `/login`             | `features/auth/login-page.tsx`            | none           | `POST /auth/admin/login`               |
| `/`                  | `features/dashboard/dashboard-page.tsx`   | any session    | `/auth/me` + one in-scope parcel count |
| `/parcels`           | `features/parcels/parcels-list-page.tsx`  | `parcels.view` | `GET /parcels`                         |
| `/parcels/$parcelId` | `features/parcels/parcel-detail-page.tsx` | `parcels.view` | `GET /parcels/:id`, `/tracking/:tn`    |
| `/tracking`          | `features/tracking/tracking-page.tsx`     | `parcels.view` | `GET /tracking/:trackingNumber`        |

### Operations that exist

`health.read` · `health.ready` · `auth.loginAdmin` · `auth.loginRider` · `auth.refresh` · `auth.otpRequest` · `auth.otpVerify` · `auth.me` · `auth.logout` · `tracking.lookup` · `parcel.list` · `parcel.read` · `parcel.create` · `parcel.updateStatus` · `parcel.cancel` · `parcel.listOwn` · `parcel.readOwn` · `parcel.createOwn` · `job.list` · `job.read` · `job.reportOutcome` · `pricing.quote`

### Tables with no API and no UI

`branches` · `customer_addresses` · `zones` · `vehicles` · `routes` · `route_stops` · `rider_locations` · `pickups` · `transfers` · `transfer_parcels` · `delivery_proofs` · `payments` · `settlements` · `notifications` · `support_tickets` · `audit_logs`

### What the docs promise but the product lacks

| Promise                                                           | Source                         | Reality                                                         |
| ----------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| Branches "managed in admin"                                       | `overview.md:68`               | no screen, no module                                            |
| Tickets "assignable to staff in admin"                            | `overview.md:130`              | no screen, no module                                            |
| Settlement payouts                                                | `overview.md:123`              | no screen, no module                                            |
| Full lifecycle: create → pickup → transfer → deliver              | `overview.md:101-114`          | create + event feed only                                        |
| "Actions are audited against your account"                        | admin sidebar footer           | **false** — nothing writes `audit_logs`                         |
| First admin is followed by accounts "in the admin's staff screen" | `bootstrap-admin.ts` docstring | no staff screen exists; it is the only code that writes `users` |

---

## 2. The blocking gap

**No reference-data endpoints exist.** `features/parcels/parcel-create-dialog.tsx` takes raw numeric IDs as text inputs — `placeholder="12"` for the sender customer, `"1"` origin hub, `"4"` destination hub, `"2"` origin zone, `"5"` destination zone. The parcels list already parses a `hubId` filter in `routes/search-params.ts` and sends it to the API, but ships no control that sets it.

Every admin screen in Phases 1-4 needs the same pickers. Phase 0 is therefore not "nice to have" — it is the thing that makes the other phases cheap rather than 20 hand-rolled implementations.

### Missing reusable scaffolding

| Component                                  | Status today                                                                                   | Where                                                                                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ServerDataTable`                          | absent. Admin hand-rolls `<Table>` + `SortableHead` + a manual pagination footer               | `packages/ui` has `DataTable` (`components/spectrumui/data-table.tsx:695`) — client-paginating, supports `selectable`/`bulkActions`/`rowActions`/`defaultSort`, used by `apps/web` but **not** by admin |
| `FormSheetShell`                           | absent. Admin uses `Dialog`; riders use `Sheet`                                                | `packages/ui` ships `Sheet*` and `Dialog*` primitives plus `FormInput`/`FormSelect`/`FormField` in `src/forms/`                                                                                         |
| `useQueryParams` / `usePaginatedListWhere` | absent. Admin uses TanStack Router `validateSearch` + a manual `patch()` that resets to page 1 | `lib/use-debounced-value.ts` is the only list utility                                                                                                                                                   |
| `ServerFormError`                          | absent. Equivalent is `components/server-error.tsx`                                            | —                                                                                                                                                                                                       |

Decide `Dialog` vs `Sheet` once, in Phase 0, and apply it to all CRUD.

---

## 3. Phase A — the surface system · prerequisite to every phase

Two changes, in this order:

- **A1 — the operation registry.** One place per surface that declares every operation's full contract, generating the policy catalog and the OpenAPI spec from it. Proved on the 5 existing admin parcel operations.
- **A2 — the namespace split.** Admin routes mount at `/api/v1/admin/*` with `admin.`-prefixed ids; the customer portal gets `/api/v1/customer/*`. Built on A1, so it costs ~5 files instead of 12.

This lands **before** Phase 0. Every module added afterwards inherits the system instead of being retrofitted, and retrofitting 20 modules is far worse than converting 5.

**Why A1 before A2, not after.** A1 deletes `openapi/coverage.ts`, the 22-id list in `smoke.ts`, and the hand-written spec fragments. If A2 ran first, all of that churn happens twice — once moving files by hand, once deleting them. Doing A1 first turns A2 from a 12-file diff into a ~5-file one.

### 3.1 The limit, stated up front

"Manage from one place" is real, but it has a ceiling: **a registry holds contracts, not behaviour.** A registry entry can say `path`, `permissions`, and which Zod schema validates the body. It cannot hold `await parcels.createParcel(...)`. So each feature is two files, always:

- `admin/registry/parcels.ts` — the contract
- `admin/handlers.ts` — the behaviour, keyed by the same string

The boot check is what makes that safe. A registry entry with no handler, or a handler with no registry entry, **throws at startup** — the two can never silently disagree. This is the same fail-closed philosophy as `assertPolicyCatalog`, applied to a much larger surface. Expect to be asked "isn't that two places again?" — the answer is "two files, one verified join key, one source of truth for everything that can drift."

### 3.2 A1 — the registry

```ts
// apps/api/src/modules/admin/registry.ts
export const ADMIN_OPERATIONS = defineSurface({
  namespace: "admin",
  basePath: "/admin",
  features: {
    parcels: {
      tag: "parcels",
      operations: {
        list: {
          method: "GET",
          path: "/parcels",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PARCELS_VIEW] },
          summary: "List parcels (staff)",
          description: "Branch/hub-scoped list. Ordering is limited to an allowlist of columns.",
          query: listParcelsQuerySchema,
          response: pageSchema(parcelResponseSchema),
        },
        cancel: {
          method: "POST",
          path: "/parcels/:id/cancel",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PARCELS_CANCEL] },
          summary: "Cancel a parcel",
          body: cancelParcelSchema,
          response: parcelResponseSchema,
          errors: { 409: "Parcel cannot be cancelled from its current status." },
        },
      },
    },
  },
})
```

The operation id is derived, not written: `namespace` + feature + key → `admin.parcel.list`. Nobody can mistype an id, and the id is guaranteed to match the mount because both come from the same object.

```ts
// apps/api/src/modules/admin/handlers.ts
export const handlers = {
  "parcels.list": async (c) =>
    c.json(response.success(await parcels.listParcelsForStaff(scopeFromAuth(c.get("auth")), c.req.valid("query"), ...))),
  "parcels.cancel": async (c) => { /* unchanged handler body */ },
}
```

`mountSurface(router, ADMIN_OPERATIONS, handlers)` then does all of it, in this order, failing closed:

1. Assert the registry ↔ handlers keys are a bijection — throw naming every orphan on either side.
2. For each operation, call `defineOperation(policy, { method, path: basePath + path })` — so the **policy catalog populates from the registry**, exactly as it does from a hand-written call today.
3. Mount the handler behind that middleware.
4. Build the OpenAPI fragment, reading bodies and params out of the Zod DTOs via `jsonSchemaOf()` — so fields are never written down twice, in either `io` mode.

**What A1 deletes**

| Gone                                                     | Because                                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `openapi/paths/parcels.openapi.ts` (196 lines)           | the admin half is generated; the customer half follows in A2                           |
| `openapi/coverage.ts`                                    | drift between catalog and spec is _structurally impossible_ — they are the same object |
| `smoke.ts:40-63` — the hardcoded 22 ids                  | derivable from the registries; the smoke test asserts the bijection instead            |
| one of the three "add an operation" steps in `AGENTS.md` | the contract is one entry, not a route call plus a spec entry that must agree          |

**What A1 does not change:** `defineOperation` itself, `assertPolicyCatalog`'s fail-closed behaviour, the `audience` check, or the DTOs. Handlers keep their current bodies — this is a wiring change, not a business-logic change.

**A1 files (4)**

| File                                     | Change                                                               |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `apps/api/src/shared/auth/surface.ts`    | **new** — `defineSurface` + `mountSurface` + the bijection assertion |
| `apps/api/src/modules/admin/index.ts`    | **new** — `mountSurface(admin, ADMIN_OPERATIONS, handlers)`          |
| `apps/api/src/modules/admin/registry.ts` | **new** — the 5 parcel operation contracts                           |
| `apps/api/src/modules/admin/handlers.ts` | **new** — the 5 handlers, moved out of `parcels.routes.ts`           |

Then `smoke.ts` drops the id list, and `apps/api/src/openapi/document.ts` imports the generated fragment instead of the hand-written one.

### 3.3 A2 — the namespace split

Directory layout is surface-first, with a shared domain core:

```text
apps/api/src/modules/
  admin/
    index.ts                        # mountSurface(admin, ADMIN_OPERATIONS, handlers)
    registry.ts                     # the one place — composes registry/*.ts
    handlers.ts                     # behaviour, keyed to the registry
    registry/
      parcels.ts                    # Phase 0 contract for 5 ops
      reference.ts                  # Phase 0
      audit.ts                      # Phase 0
      branches.ts                   # Phase 1
      hubs.ts  zones.ts  users.ts  roles.ts  customers.ts
      # … Phase 2: pricing-rules, vehicles, routes, riders
      # … Phase 3: pickups, transfers, deliveries, delivery-proofs
      # … Phase 4: payments, settlements, support-tickets, notifications, stats
  customer/
    index.ts
    registry.ts
    handlers.ts
    registry/parcels.ts             # 3 customer ops
  parcels/
    parcels.service.ts              # shared — does not move
    parcels.repository.ts           # shared — does not move
  auth/ health/ jobs/ pricing/ tracking/   # unchanged — cross-audience, public, or out of scope
```

`registry/` splits per feature because at 120 operations one flat file is unnavigable. `registry.ts` is still the single place to look; it is a file that composes others, not a second source of truth.

**The split rule.** A surface owns the **wire contract**; a domain owns the **business logic**:

| Belongs to the surface                     | Belongs to the domain                        |
| ------------------------------------------ | -------------------------------------------- |
| registry entry — path, policy, DTOs, prose | `*.service.ts` — business rules              |
| `handlers.ts` — transport                  | `*.repository.ts` — SQL, takes an `Executor` |

`parcels.service.ts` cannot be duplicated: `createParcel` is called by the staff route (`parcels.routes.ts:84`) _and_ the customer route (`:202`), and `getParcelItems` by both (`:62`, `:180`). The DTOs are genuinely per-surface already — `createParcelSchema` takes `senderCustomerId` from the body, `createOwnParcelSchema` deliberately does not accept the field at all (`:200-206`) — so they stay in the two surface registries.

**This deviates from `api-modules` co-location**, and `AGENTS.md` must say so: where a domain has more than one surface, service and repository live in `modules/{domain}/` and each surface contributes only its registry entry and handlers. Every admin-only domain in Phases 1-4 has one surface, so those keep all four files.

### 3.4 The blocker: the operation-id regex

`assertPolicyCatalog` (`apps/api/src/shared/auth/policy.ts:102`) rejects any id that is not `{domain}.{action}`:

```ts
if (!/^[a-z][a-zA-Z]*\.[a-zA-Z]+$/.test(id)) {
  throw new Error(`Operation id "${id}" must look like "{domain}.{action}"`)
}
```

`admin.parcel.list` has two dots and **throws at boot**. Relax it to one or two segments, and — since the point of the prefix is to be a real discriminator — require that a two-segment id starts with a known namespace:

```ts
const NAMESPACES = new Set(["admin", "customer", "rider"])

if (!/^[a-z][a-zA-Z]*(\.[a-zA-Z]+){1,2}$/.test(id)) {
  throw new Error(
    `Operation id "${id}" must look like "{domain}.{action}" or "{namespace}.{domain}.{action}"`,
  )
}
if (id.split(".").length === 3 && !NAMESPACES.has(id.split(".")[0])) {
  throw new Error(
    `Operation id "${id}" must start with a known namespace: ${[...NAMESPACES].join(", ")}`,
  )
}
```

If A1 lands first, `defineSurface` derives ids and the regex is the only thing that can reject a bad one — which is exactly the shape you want.

### 3.5 The migration — all 22 operations

`defineOperation`'s second argument is the **absolute mounted path**, not a relative one, so both it and the OpenAPI fragment key must change together (`coverage.ts:65` compares them). Anything not listed keeps its current path and id.

| Current id            | Audience  | New id                      | New path                          |
| --------------------- | --------- | --------------------------- | --------------------------------- |
| `parcel.list`         | admin     | `admin.parcel.list`         | `GET /admin/parcels`              |
| `parcel.read`         | admin     | `admin.parcel.read`         | `GET /admin/parcels/:id`          |
| `parcel.create`       | admin     | `admin.parcel.create`       | `POST /admin/parcels`             |
| `parcel.updateStatus` | admin     | `admin.parcel.updateStatus` | `PATCH /admin/parcels/:id/status` |
| `parcel.cancel`       | admin     | `admin.parcel.cancel`       | `POST /admin/parcels/:id/cancel`  |
| `parcel.listOwn`      | web       | `customer.parcel.list`      | `GET /customer/parcels`           |
| `parcel.readOwn`      | web       | `customer.parcel.read`      | `GET /customer/parcels/:id`       |
| `parcel.createOwn`    | web       | `customer.parcel.create`    | `POST /customer/parcels`          |
| `health.*` (2)        | public    | unchanged                   | unchanged                         |
| `auth.*` (7)          | mixed     | unchanged                   | unchanged                         |
| `tracking.lookup`     | public    | unchanged                   | unchanged                         |
| `pricing.quote`       | admin+web | unchanged                   | unchanged — see 3.6               |
| `job.*` (3)           | riders    | unchanged                   | unchanged — see 3.7               |

Note the customer paths get **shorter**, not longer: `/parcels/mine/list` becomes `/customer/parcels`, because the namespace now says what `/mine` was repeating. The `mine` suffix disappears rather than being kept alongside.

### 3.6 A2 files that must change — 5

A1 already removed the spec fragments and the smoke id list, so this is the residue:

| #   | File                                                         | Change                                                                             |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1   | `apps/api/src/shared/auth/policy.ts`                         | regex + `NAMESPACES` + error message (§3.4)                                        |
| 2   | `apps/api/src/modules/index.ts`                              | 2 new entries: `{ name: "admin", basePath: "/admin" }` and the customer equivalent |
| 3   | `apps/api/src/modules/customer/{index,registry,handlers}.ts` | **new** — the 3 customer operations, split out of `parcels.routes.ts`              |
| 4   | `apps/api/src/modules/parcels/parcels.dto.ts`                | staff and customer schemas split to their two registries                           |
| 5   | `apps/admin/src/lib/endpoints.ts`                            | 5 path strings, lines 34-62 — the **only** client change                           |

`apps/api/src/modules/parcels/parcels.service.ts` and `parcels.repository.ts` are **not** in the list — they do not move, so `check:read-paths.ts` keeps importing them from the same path.

Two things that are **safe** and worth knowing so nobody re-checks them:

- `apps/api/scripts/check-read-paths.ts` imports repository functions directly (`await import("../src/modules/parcels/parcels.repository")`), never HTTP paths. It does not break.
- `apps/admin/src/lib/navigation.ts` deals in TanStack Router paths, not API paths. It does not break.

### 3.7 Judgement calls flagged, not decided

**`pricing.quote` stays at `/pricing/quote`.** It is genuinely cross-audience (admin and web both call it) and serves one calculation. Splitting it would duplicate the DTOs for one function. Same category as `auth.*` — a shared module, not a surface. Revisit in Phase 2 if `pricing_rules` CRUD makes the audiences diverge.

**Where the generated OpenAPI lives.** A1 generates the admin fragment. Whether it is written to `src/openapi/paths/` (where `AGENTS.md` documents it) or kept in memory and only ever served at `/openapi.json` is a real choice: the second removes a file-writing concern but breaks the documented path contract. **Default: generate in memory, serve at `/openapi.json`, and update `AGENTS.md` to say the spec is derived rather than authored.** That is the honest end state once a registry exists.

**Version bump: in place, or `/api/v2`?** Recommendation is **in place**, because this project is pre-production — `docs/handoff.md` lists live E2E as impossible and there is no deployed consumer to break. Mount both `v1` (frozen) and `v2` only if something outside this repo already calls the API. **Confirm before starting: is any external system calling this API today?**

### 3.8 Riders are deliberately out of scope

`job.*` is a rider-only surface and would become `/api/v1/rider/jobs` with `rider.job.*` ids by the same logic. That widens the diff into `apps/riders`, which this does not touch. It is a clean follow-up — do it after Phase 0 lands, as its own change, once the registry has proved itself on two surfaces.

### 3.9 Gate

**After A1**

1. `bun run --cwd apps/api smoke` passes with the id list replaced by the bijection check.
2. `GET /openapi.json` still shows all 5 parcel operations, with the same bodies as before — compare the JSON, not your memory.
3. `openapi/coverage.ts` is deleted and nothing imports it.
4. A deliberately broken key (rename one handler) fails boot with both orphans named.

**After A2**

1. `bun run --cwd apps/api smoke` and `bun run typecheck` pass across all four apps.
2. `GET /openapi.json` shows all 22 operations under `/admin`, `/customer`, `/auth`, `/health`, `/jobs`, `/pricing`, `/tracking` — and nothing admin-tagged outside `/admin`.
3. A staff token gets 401 on `/api/v1/customer/parcels`; a customer token gets 401 on `/api/v1/admin/parcels`. Both are the `audience` check at `policy.ts:72`, so this is a regression test, not a new mechanism.
4. The admin portal loads, lists parcels, and creates one end to end against the moved paths.

---

## 4. The plan — five phases

Sequential. Each phase's **Gate** must pass before the next starts. Estimates assume one engineer familiar with the codebase; they exclude review, the restructure in §3, and the cross-cutting work in §5.

### Phase 0 — Foundation · ~2-3 days · 2 modules, ~10 operations

Nothing else is buildable without this. Both modules land as registry entries in the `admin/` surface established in §3, so they mount at `/api/v1/admin/reference/...` and `/api/v1/admin/audit-logs` with `admin.*` ids — no `*.routes.ts` file to write, just a registry entry and a handler.

**API**

| Module      | Ops | Registry entry          | Contents                                                                                                                    |
| ----------- | --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `reference` | ~7  | `registry/reference.ts` | read endpoints for hubs, zones, branches, customer search, users, riders, vehicles — all gated by the matching `*.view` key |
| `audit`     | ~3  | `registry/audit.ts`     | `GET /audit-logs` (`audit.view`) **plus the writer** wired into every mutation service                                      |

`audit_logs` has a seeded permission, a documented purpose, and a UI claim that is currently false. Retrofitting a writer into 20 mutation services later costs several times what doing it now costs.

**UI — `packages/ui`, then `apps/admin`**

1. `ServerDataTable` — server-driven wrapper over the existing `DataTable`.
2. `FormSheetShell` + `useFormSheetState` — one overlay decision, applied to all CRUD.
3. `ServerFormError` — maps `error.details` → RHF field errors (there is a local precedent in `features/parcels/parcel-form-errors.tsx` to promote).
4. `usePaginatedListWhere` for TanStack Router — URL-driven filters, debounce, page reset.
5. Replace the raw-ID inputs in `parcel-create-dialog.tsx` with real comboboxes; add the missing `hubId` filter control.

**Gate:** the parcel-create dialog has zero numeric-ID text inputs, and the parcels list has a working `hubId` control. One reference-driven list screen and one reference-driven CRUD screen exist end to end, as the pattern for Phases 1-4.

---

### Phase 1 — Organization & people · ~4-5 days · 6 modules, ~34 operations

The "admin and their staffs" core: who works here, what they may do, which hubs they can see.

| Module      | Ops | Screens                                                        | Notes                                                              |
| ----------- | --- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `branches`  | 4   | list, create/edit sheet                                        | regional office; code, district, lat/lng, ACTIVE/INACTIVE          |
| `hubs`      | 5   | list, create/edit, capacity view                               | ORIGIN/SORTING/TRANSIT/DESTINATION, capacity, MAINTENANCE status   |
| `zones`     | 4   | list, create/edit                                              | geographic pricing areas                                           |
| `users`     | 5   | list, create, edit, reset password, activate/deactivate        | `bootstrap-admin.ts` is currently the only writer of a `users` row |
| `roles`     | 5   | **permission matrix editor**                                   | checkbox grid over all 40 keys                                     |
| `customers` | 6   | list, detail (addresses, parcel history), activate TEMP→ACTIVE | also covers `customer_addresses`                                   |

**The permission matrix is the highest-leverage screen in the product.** `apps/api/scripts/seed.ts` is `INSERT IGNORE` and never revokes, so a misconfigured role can only be fixed by hand-written SQL. This screen makes grants editable and revocable, which is the point of having `roles.view`/`roles.manage` at all.

**Gate:** a `BRANCH_MANAGER` can be created from the UI, given a role from the matrix editor, and scoped to specific hubs — and that scope demonstrably narrows their `GET /admin/parcels` result set. `user_hubs` is only meaningful once this works; today nothing can write to it except SQL.

---

### Phase 2 — Network, pricing & fleet · ~3 days · 4 modules, ~24 operations

| Module                   | Ops | Notes                                                                                      |
| ------------------------ | --- | ------------------------------------------------------------------------------------------ |
| `pricing-rules`          | 6   | `pricing.quote` exists as a read; there is **zero CRUD** on the underlying `pricing_rules` |
| `vehicles`               | 5   | BIKE/VAN/TRUCK/COVERED_VAN, `capacity_kg`, availability                                    |
| `routes` + `route_stops` | 8   | hub-to-hub path, distance, ETA, ACTIVE/INACTIVE, ordered stops with ETA offsets            |
| `riders`                 | 6   | profile → `users`, home hub, `compensation_type`, status                                   |

**Gate:** a branch manager can set a price for a zone pair and weight band, register a vehicle, lay out a route with stops, and onboard a rider. Only then does `pricing.quote` have anything to quote from that staff can maintain.

---

### Phase 3 — Operations execution · ~5-6 days · 5 modules, ~30 operations

The actual parcel lifecycle, and the largest phase. The rider app reaches deliveries only through `jobs` and has no pickup or transfer work at all.

| Module                           | Ops | Notes                                                                                          |
| -------------------------------- | --- | ---------------------------------------------------------------------------------------------- |
| `pickups`                        | 5   | `pickups.assign` — the missing link between a booked parcel and a rider                        |
| `transfers` + `transfer_parcels` | 8   | load/unload manifest; `driver_id` is **staff** (`users`), not a rider                          |
| `deliveries` (admin side)        | 5   | view attempts, reassign, `deliveries.assign`; only one attempt open at a time, enforced by API |
| `delivery-proofs`                | 4   | `rider.proof.submit` is a seeded key with **no endpoint** — rider POD is a placeholder today   |
| rider `jobs` extension           | 3   | pickup and transfer jobs, so the rider app has work to fetch                                   |

**Gate:** a parcel goes created → pickup assigned → transferred between hubs → delivered with proof, with one admin screen per stage, and a failed delivery creates attempt 2 rather than a duplicate row. Land the retry semantics before promising retry UX — `attempt_no` is a unique `(parcel_id, attempt_no)` constraint whose "only one open" rule currently exists only as intent.

**Cross-app note:** this phase changes the rider app too. Do not start it without `apps/riders` in scope.

---

### Phase 4 — Money, support, oversight · ~3 days · 5 modules, ~22 operations

| Module            | Ops | Screens                                              |
| ----------------- | --- | ---------------------------------------------------- |
| `payments`        | 5   | list, record COD remittance, refund                  |
| `settlements`     | 5   | period payout to a customer, PENDING→PAID            |
| `support-tickets` | 5   | list, assign to staff, resolve                       |
| `notifications`   | 3   | outbox viewer + retry (SMS/EMAIL/PUSH)               |
| `stats`           | 1   | replace the getting-started dashboard with real KPIs |

Dashboard KPIs: parcels by status, in-scope count, failed deliveries, COD outstanding, unsettled balance.

**Gate:** the four promises in `overview.md` that have no screen today (branches, ticket assignment, settlement payouts, and the sidebar's audit claim) are all delivered or explicitly re-scoped in the docs.

---

## 5. Cross-cutting work · runs alongside every phase

| #   | Item                          | Why it cannot be deferred                                                                                                                                                                                                                                                                            |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Audit writer**              | Wired into every mutation service. Cheapest on day one, retrofitted expensively. Until it lands, the sidebar's audit claim is false.                                                                                                                                                                 |
| 2   | **Notification dispatch**     | `notifications` is a table with no writer. Trigger it on `parcel_events` writes, which Phases 3-4 produce heavily.                                                                                                                                                                                   |
| 3   | **Redis cache driver**        | OTP and rate limiting are per-process in-memory, so they break across multiple API instances. Blocker for production; not for features.                                                                                                                                                              |
| 4   | **A test runner**             | Zero tests exist. `smoke` catches catalog drift and `check:read-paths` catches bad columns, but **no business logic is covered**. Add vitest + service-level tests as each Phase 1-4 module lands.                                                                                                   |
| 5   | **Per-operation bookkeeping** | Once A1 lands, a new operation is **one registry entry plus one handler** — the policy entry and the spec are generated, so `document.ts` needs no import and `smoke.ts` no id line. Before A1, `apps/api/scripts/smoke.ts:40-63` hardcodes all 22 ids and a missing fragment fails boot on purpose. |
| 6   | **The admin namespace guard** | After A2 lands, add a boot assertion that no operation with an `admin.` id is mounted outside `/admin`, and that `/admin` carries no non-admin audience. The prefix is only worth having if something enforces it.                                                                                   |
| 7   | **Document the new system**   | `AGENTS.md` still documents a three-part "add an operation" contract (route + policy, DTOs, OpenAPI entry) and the `openapi/paths/<domain>.openapi.ts` location. Both change under A1/A2. A stale contract is worse than none — it is the file people trust and stop reading.                        |

---

## 6. The Phase 0 decision

**What shape should reference data take?** Three options:

1. **One `reference` module, ~7 read operations** — single registry entry set, single permission story, one place to add a picker later. _Recommended._ Downside: not a domain noun, so it will not grow into CRUD; Phase 1 supersedes parts of it.
2. **Three modules** — `hubs`, `zones`, `customers` read-only now, gaining CRUD in Phase 1. Cleaner boundary, but the same fragment is written three times and each table is split across two modules.
3. **Sub-resources on future modules** — `GET /hubs?picker=1`. No separate module, but every picker call then needs its own permission mix, and Phase 0 still has to invent the response shape.

Decision owner: whoever writes Phase 0. Options 1 and 2 differ mainly in how much of Phase 0 Phase 1 throws away — 1 discards more, 2 discards nothing but writes more boilerplate now.

Still open from §3, and worth answering before §3 starts rather than during: **is any external system calling this API today?** That decides in-place vs `/api/v2`.

---

## 7. Checkpoints

Run after any phase, and after touching SQL within a phase:

```bash
bun run typecheck
bun run --cwd apps/api smoke          # policy catalog + OpenAPI coverage, no DB needed
bun run --cwd apps/api check:read-paths   # every SELECT against the real schema, needs db:migrate
```

`smoke` is the drift guard: a route that is enforced but undocumented, or documented but not enforced, or whose `operationId`/method/path disagrees with the mount, throws at boot. It fails closed by design — that is the point, not an obstacle.

---

## 8. Out of scope for the admin portal

Stated so it is not relitigated mid-phase. These follow from `AGENTS.md` architecture rules and are not open questions.

- No separate branch or hub portal. Branch/hub staff use `apps/admin` with role + `user_hubs` scoping.
- No `permissions` catalog table. Keys stay static in `apps/api/src/shared/auth/permissions.ts`; `role_permissions.permission_key` stays a string column.
- No customer passwords and no MySQL OTP tables. Customers are not RBAC users.
- No guest parcel booking. Unauthenticated tracking by tracking number stays public and stays rate-limited.
- No new apps. Every screen in this plan lives in `apps/admin`.
- No `mysql2` import in `apps/api`. The database is reached only through `@dropx/db`.
- No rider-surface rename. `/jobs` and `job.*` stay as they are — see §3.6.
