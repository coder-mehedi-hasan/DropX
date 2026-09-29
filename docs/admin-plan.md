# Admin & Ops Portal — Feature Plan

**Written:** 2026-09-30, from an inventory of `apps/admin`, `apps/api/src/modules`, `migrate.sql`, and `docs/`.
**Status:** plan only. Nothing in it is implemented.
**Companion docs:** [`overview.md`](./overview.md) (product), [`rbac.md`](./rbac.md) (roles & permission keys), [`er-diagram.md`](./er-diagram.md) (schema), [`handoff.md`](./handoff.md) (point-in-time session notes).

> This document does **not** restate the architecture rules in [`AGENTS.md`](../AGENTS.md). Read that first — it is authoritative for layout, commands, API conventions, and the "adding an operation" contract. Everything below assumes it.

## Decisions already taken

| Decision                                   | Choice                                                                                                                                                               | Section |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Order of work                              | **registry (A1) first, then the namespace split (A2)** — otherwise the spec churn happens twice                                                                      | §3      |
| Phase 0 scope                              | **the `reference` module only** — the `audit` writer is deferred (§4, Phase 0)                                                                                       | §4      |
| Reference endpoints                        | **3 landed** — hubs, zones, customers; branches/users/riders/vehicles wait for a screen that asks                                                                    | §4, §6  |
| `zones.view` for `BRANCH_MANAGER`          | **open, blocks the Phase 0 gate** — the role that books parcels cannot list zones                                                                                    | §4      |
| Status                                     | **Phase 0 complete** — registry on two surfaces, namespace split done, no hand-written parcels; reference module landed and verified; UI gate built and applied (§4) |
| How the admin surface is namespaced        | `/api/v1/admin/*` mount + `admin.` id prefix                                                                                                                         | §3.3    |
| What happens to the mixed `parcels` module | split — admin and customer get own namespaces                                                                                                                        | §3.5    |
| Layout under the new namespace             | `modules/admin/` with `registry.ts` + `handlers.ts` — surface-first, one place for contracts                                                                         | §3.3    |
| Where shared logic lives                   | `modules/{domain}/*.service.ts` + `*.repository.ts` stay put; only the contract is per surface                                                                       | §3.3    |
| Registry scope                             | **admin surface only, proved on 5 operations** — extend once it works                                                                                                | §3.2    |
| Riders                                     | out of scope for this change                                                                                                                                         | §3.8    |

Closed since the first draft: the generated OpenAPI is **in memory**, served at `/openapi.json` rather than written to `openapi/paths/` (§3.7); the version bump is **in place** (§3.7).

Closed: the customer half of the namespace split (§3.9), the reference-data shape (§6) — the `reference` module's three operations are built and verified (§4, Phase 0). The registry is now proved on **two** surfaces, 33 operations. The `zones.view` grant for `BRANCH_MANAGER` is in code and in `docs/rbac.md`; the seeded role rows themselves still need the normal seed/deployment path to pick it up (§4).

Still open: nothing on the Phase 0 surface. Phase 1 is in progress — the `org` module (branches and hubs) is landed (§4).

---

## 1. Where the admin stands today

| Dimension       | Built                                                                                                                                                                                | Missing                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Admin screens   | 5 — login, dashboard, parcels list, parcel detail, tracking                                                                                                                          | ~20 more                                     |
| Nav items       | 3 — Dashboard, Parcels, Tracking                                                                                                                                                     | ~14 more                                     |
| API modules     | 7 — health, auth, tracking, parcels, jobs, pricing, org. 33 operations, all documented, zero OpenAPI drift                                                                           | ~23 modules                                  |
| DB tables wired | 13 of 29 (`customers`, `deliveries`, `hubs`, `parcel_events`, `parcel_items`, `parcels`, `pricing_rules`, `riders`, `role_permissions`, `roles`, `user_hubs`, `user_roles`, `users`) | 16 tables have no API **and** no UI anywhere |
| Permissions     | 40 keys declared, 7 roles seeded, **9 enforced** (`parcels.view/create/update/cancel`, `rider.jobs.view/update`, `hubs.view`, `zones.view`, `customers.view`)                        | 31 keys gate nothing                         |
| Tests           | Zero test files. No test runner in any `package.json`                                                                                                                                | whole layer                                  |

**The hard truth:** admin can create, list, inspect, and cancel a parcel, and can now also build the organization that parcels move through — branches and hubs, with full CRUD. Pickup, transfer, delivery assignment, payment, settlement, and support exist in `migrate.sql` and in `docs/overview.md:101-114`, but in neither the API nor the UI. Every admin screen past the parcels list and the org screens is unbuilt.

### Screens that exist

| Route                | File                                      | Guard          | Reads                                  |
| -------------------- | ----------------------------------------- | -------------- | -------------------------------------- |
| `/login`             | `features/auth/login-page.tsx`            | none           | `POST /auth/admin/login`               |
| `/`                  | `features/dashboard/dashboard-page.tsx`   | any session    | `/auth/me` + one in-scope parcel count |
| `/parcels`           | `features/parcels/parcels-list-page.tsx`  | `parcels.view` | `GET /parcels`                         |
| `/parcels/$parcelId` | `features/parcels/parcel-detail-page.tsx` | `parcels.view` | `GET /parcels/:id`, `/tracking/:tn`    |
| `/tracking`          | `features/tracking/tracking-page.tsx`     | `parcels.view` | `GET /tracking/:trackingNumber`        |

### Operations that exist

`health.read` · `health.ready` · `auth.loginAdmin` · `auth.loginRider` · `auth.refresh` · `auth.otpRequest` · `auth.otpVerify` · `auth.me` · `auth.logout` · `tracking.lookup` · `parcel.list` · `parcel.read` · `parcel.create` · `parcel.updateStatus` · `parcel.cancel` · `parcel.listOwn` · `parcel.readOwn` · `parcel.createOwn` · `job.list` · `job.read` · `job.reportOutcome` · `pricing.quote` · `admin.reference.listHubs` · `admin.reference.listZones` · `admin.reference.searchCustomers` · `admin.org.listBranches` · `admin.org.readBranch` · `admin.org.createBranch` · `admin.org.updateBranch` · `admin.org.listHubs` · `admin.org.readHub` · `admin.org.createHub` · `admin.org.updateHub`

### Tables with no API and no UI

`customer_addresses` · `zones` · `vehicles` · `routes` · `route_stops` · `rider_locations` · `pickups` · `transfers` · `transfer_parcels` · `delivery_proofs` · `payments` · `settlements` · `notifications` · `support_tickets` · `audit_logs`

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

### Missing reusable scaffolding — all five landed

| Component                                  | Status today                                                                                                                                                                                                                 | Where                                                                                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ServerDataTable`                          | **adopted** — the parcels list renders through it now, so it is proven against a real screen. `SortableHead`, `TableFooter` and the bespoke pagination footer are gone; sort, pager and row range all come from the wrapper. | `packages/ui/src/components/server-data-table.tsx` — server-driven wrapper over the existing `DataTable` (`components/spectrumui/data-table.tsx:695`), which is client-paginating and used by `apps/web` |
| `FormSheetShell` + `useFormSheetState`     | built **and applied** — `parcel-create-dialog.tsx` is a sheet now                                                                                                                                                            | `packages/ui/src/forms/form-sheet-shell.tsx` — owns the `<form>`, busy-guarded dismissal, reset-on-open, close-cleanup; ships `Sheet*` primitives in `components/ui/sheet.tsx`                           |
| `useQueryParams` / `usePaginatedListWhere` | **in use** — the parcels list's hand-rolled `patch()`, debounce, search box and two filter selects are all these now                                                                                                         | `apps/admin/src/lib/list-params.ts` + `components/list-search-bar.tsx` / `components/list-filter-select.tsx`                                                                                             |
| `ServerFormError`                          | **in use** — promoted out of `features/parcels/parcel-form-errors.tsx`, which is now just the parcel label map                                                                                                               | `packages/ui/src/forms/server-form-errors.tsx` — transport-agnostic by shape, which is what lets it live in `packages/ui` without importing any app's `ApiError`                                         |

The overlay decision is settled: a sheet, for every CRUD form so far. A genuinely multi-section entity is a route, not a sheet.

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

| Gone                                                                   | Because                                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| the staff half of `openapi/paths/parcels.openapi.ts` (196 -> 89 lines) | generated from the registry; the customer half follows in A2                     |
| `smoke.ts:40-63` — the hardcoded 22 ids                                | surface ids now come from the registry, so adding one needs no edit to this file |
| one of the three "add an operation" steps in `AGENTS.md`               | the contract is one entry, not a route call plus a spec entry that must agree    |

**`openapi/coverage.ts` survived**, which the first draft of this plan got wrong. It is no longer needed _for a registry operation_ — those are generated from the same object that registered the policy, so there is nothing to drift. But 17 operations across `auth`, `jobs`, `tracking`, `pricing` and the customer `parcels` are still hand-written, and for those it is a real check that still catches real bugs. Deleting it now would throw away a working guard. Its scope is now documented: it guards the hand-written fragments, and goes when the last module moves to a registry.

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

| Current id            | Audience  | New id                       | New path                          |
| --------------------- | --------- | ---------------------------- | --------------------------------- |
| `parcel.list`         | admin     | `admin.parcels.list`         | `GET /admin/parcels`              |
| `parcel.read`         | admin     | `admin.parcels.read`         | `GET /admin/parcels/:id`          |
| `parcel.create`       | admin     | `admin.parcels.create`       | `POST /admin/parcels`             |
| `parcel.updateStatus` | admin     | `admin.parcels.updateStatus` | `PATCH /admin/parcels/:id/status` |
| `parcel.cancel`       | admin     | `admin.parcels.cancel`       | `POST /admin/parcels/:id/cancel`  |
| `parcel.listOwn`      | web       | `customer.parcel.list`       | `GET /customer/parcels`           |
| `parcel.readOwn`      | web       | `customer.parcel.read`       | `GET /customer/parcels/:id`       |
| `parcel.createOwn`    | web       | `customer.parcel.create`     | `POST /customer/parcels`          |
| `health.*` (2)        | public    | unchanged                    | unchanged                         |
| `auth.*` (7)          | mixed     | unchanged                    | unchanged                         |
| `tracking.lookup`     | public    | unchanged                    | unchanged                         |
| `pricing.quote`       | admin+web | unchanged                    | unchanged — see 3.7               |
| `job.*` (3)           | riders    | unchanged                    | unchanged — see 3.8               |

**The admin ids are plural** (`admin.parcels.list`, not `admin.parcel.list`) because the id is `namespace` + feature key + operation key, and the feature is `parcels` to match the tag and the `parcels.dto.ts` it draws its schemas from. That is the point of deriving the id: you read the registry and know the id without consulting a table of conventions.

Note the customer paths get **shorter**, not longer: `/parcels/mine/list` becomes `/customer/parcels`, because the namespace now says what `/mine` was repeating. The `mine` suffix disappears rather than being kept alongside. **Done** — `customer/registry.ts` is its own surface, and the customer ids are plural (`customer.parcels.*`) for the same reason the admin's are.

### 3.6 A2 files that must change — 6

A1 already removed the spec fragments and the smoke id list, so this is the residue:

| #   | File                                                         | Change                                                                                                                                 |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/api/src/shared/auth/policy.ts`                         | regex + `NAMESPACES` + error message (§3.4) — **done**                                                                                 |
| 2   | `apps/api/src/modules/index.ts`                              | `{ name: "admin", ... }` and `{ name: "customer", ... }` — **done**                                                                    |
| 3   | `apps/api/src/modules/customer/{index,registry,handlers}.ts` | **done** — the 3 customer operations, split out of `parcels.routes.ts`                                                                 |
| 4   | `apps/api/src/modules/parcels/parcels.dto.ts`                | **done** — `createOwnParcelSchema` moved to the customer registry; the shared schemas stayed, since both surfaces book the same entity |
| 5   | `apps/admin/src/lib/endpoints.ts`                            | 5 path strings, lines 34-62 — **done**                                                                                                 |
| 6   | `apps/web/src/lib/api.ts`                                    | 3 path strings — **done**. Not in the original 5: the customer split moves these too, and a missed one is a portal that 404s           |

`apps/api/src/modules/parcels/parcels.service.ts` and `parcels.repository.ts` are **not** in the list — they do not move, so `check:read-paths.ts` keeps importing them from the same path.

Two things that are **safe** and worth knowing so nobody re-checks them:

- `apps/api/scripts/check-read-paths.ts` imports repository functions directly (`await import("../src/modules/parcels/parcels.repository")`), never HTTP paths. It does not break.
- `apps/admin/src/lib/navigation.ts` deals in TanStack Router paths, not API paths. It does not break.

### 3.7 Judgement calls flagged, not decided

**`pricing.quote` stays at `/pricing/quote`.** It is genuinely cross-audience (admin and web both call it) and serves one calculation. Splitting it would duplicate the DTOs for one function. Same category as `auth.*` — a shared module, not a surface. Revisit in Phase 2 if `pricing_rules` CRUD makes the audiences diverge.

**Where the generated OpenAPI lives — decided: in memory.** `surface-spec.ts` returns a `paths` object that `document.ts` spreads in; nothing is written to `src/openapi/paths/`. The spec is derived, not authored, and `AGENTS.md` now says so. A file on disk would be a second thing to keep in sync, which is the thing this change exists to remove.

**Version bump — decided: in place.** The project is pre-production; `docs/handoff.md` lists live E2E as impossible and there is no deployed consumer to break. The paths moved under `/api/v1` rather than a new `/api/v2`. If an external caller does exist, this decision needs revisiting before it ships.

### 3.8 Riders are deliberately out of scope

`job.*` is a rider-only surface and would become `/api/v1/rider/jobs` with `rider.job.*` ids by the same logic. That widens the diff into `apps/riders`, which this does not touch. It is a clean follow-up — do it after Phase 0 lands, as its own change, once the registry has proved itself on two surfaces.

### 3.9 Gate

**After A1 — passed**

1. ✅ `smoke` green, 22 operations, 0 failures.
2. ✅ `/openapi.json` diffed against the pre-change baseline. Every request body, response body, status code and error description is **byte-identical**. The only differences are the intended `admin.parcels.*` rename and `/admin` path prefix, plus `minLength: 1` appearing on the `id` path param — the hand-written fragment claimed `{ type: "string" }` while the DTO has always rejected an empty id. That is the payoff of deriving from the schema.
3. ⚠️ `openapi/coverage.ts` is **kept**, deliberately — see the A1 table above. Gate item corrected rather than met.
4. ✅ A renamed handler key fails boot with both orphans named: `registry entries with no handler: parcels.cancel; handlers with no registry entry: parcels.cancle`.
5. ✅ `bun run typecheck` green across all six workspaces.

A1 added two smoke assertions not in the original gate: every `/admin` operation requires the `admin` audience, and every `admin.`-prefixed id is mounted under `/admin`. The prefix is only worth having if something enforces it.

**After A2 — passed, except item 4**

1. ✅ `smoke` green (22 operations, 0 failures) and `bun run typecheck` green across all six workspaces.
2. ✅ `GET /openapi.json` has 22 operations and 20 paths under `/admin`, `/customer`, `/auth`, `/health`, `/jobs`, `/pricing`, `/tracking`. Paths went 21 → 20 because three `/parcels/mine*` collapse into two `/customer/parcels*`. Nothing `admin.`-prefixed sits outside `/admin`; nothing `customer.`-prefixed sits outside `/customer`.
3. ⚠️ Structural half done: `smoke` asserts every `/customer` operation requires the `web` audience, requires **no** permission, and is unreachable by the `admin` audience. The runtime half — a real staff token against a real customer route — still needs a migrated database.
4. ❌ **Not done.** The admin portal loading, listing, and creating a parcel end to end needs a live database and a browser. The paths and the client calls are verified; nothing above them is exercised.

**Live probes actually run** (no database, anonymous caller, real server):

| Request                                    | Result | Why it matters                                                                          |
| ------------------------------------------ | ------ | --------------------------------------------------------------------------------------- |
| `POST /api/v1/customer/parcels` + bad body | 401    | policy runs before the body validator, so no work happens on an unauthenticated request |
| `GET /api/v1/customer/parcels`             | 401    | the customer mount is gated                                                             |
| `GET /api/v1/admin/parcels`                | 401    | unchanged by the split                                                                  |
| `GET /api/v1/parcels/mine/list`            | 404    | the old path is gone, not aliased to the new one                                        |
| `GET /api/v1/tracking/xx`                  | 422    | a public operation's validator still runs after its policy                              |

**A2 diffed against the pre-A1 baseline.** Every request body, response body, status code and error description is identical. The only differences: the eight renamed ids, the path prefixes, two description rewordings, and `minLength: 1` appearing on `:id` path params — the DTO always rejected an empty id and the hand-written fragments never said so.

**Two defects found by diffing rather than by reading:**

- **Duplicate `parcels` tag.** Splitting one feature across two surfaces produced two `parcels` entries in the top-level `tags` array with different descriptions, which OpenAPI disallows and Swagger UI renders as two identically-titled headings. `buildSurfaceTags` now takes every surface and emits one entry per distinct name, with an explicit `tagDescription` winning regardless of argument order. `smoke` now asserts tag names are unique, that every operation tag is declared, and that no tag is unused — so it cannot come back.
- **Wrong 403 on the customer surface.** The built-in 403 text is "Missing a required permission", which is false for a customer: they hold no permissions, so a 403 can only mean the session is not ACTIVE. Rather than restate it in three entries, `defineSurface` gained a surface-level `errors` block, and precedence is now operation → surface → built-in.

**What deleting `parcels.routes.ts` did not touch:** `parcels.service.ts`, `parcels.repository.ts`, and the shared schemas in `parcels.dto.ts` stayed put, so `check:read-paths.ts` still imports the repository from the same path. What is gone is the module _mount_ — `moduleManifest()` now reports `customer` where it used to report `parcels`, which is visible on `GET /api/v1`.

---

## 4. The plan — five phases

Sequential. Each phase's **Gate** must pass before the next starts. Estimates assume one engineer familiar with the codebase; they exclude review, the restructure in §3, and the cross-cutting work in §5.

### Phase 0 — Foundation · ~2-3 days · 1 module, 3 operations (API landed)

**Status: complete.** The API half and the UI half are both built and verified. See "Where Phase 0 actually stands" below before planning further work.

Nothing else is buildable without this. The module lands as a registry entry in the `admin/` surface established in §3, so it mounts at `/api/v1/admin/reference/...` with `admin.*` ids — no `*.routes.ts` file to write, just a registry entry and a handler. The `audit` module is deferred; see below.

**API**

| Module      | Ops | Registry entry      | Contents                                                                                                                                           |
| ----------- | --- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference` | 3   | `admin/registry.ts` | **LANDED.** `hubs`, `zones`, `customers` — the three the parcel-create gate needs, each gated by its own matching `*.view` key                     |
| `audit`     | ~3  | deferred            | **OUT OF SCOPE for now.** The `audit.view` key and the `audit_logs` table stay; nothing consumes them. Revisit before the first production deploy. |

`audit_logs` has a seeded permission, a documented purpose, and a UI claim that is currently false. Retrofitting a writer into 20 mutation services later costs several times what doing it now costs.

**Deferred, and that is a decision with a cost.** The `audit` module is out of scope for now, so Phase 0 is the `reference` module alone. What that buys: one surface, three read operations, and the picker layer every later phase depends on — reached with one concept in the code. What it defers: the writer. Every mutation service that lands in Phases 1-4 is a service the writer will later have to be added to, and a service written without it is one someone has to remember to come back for.

The mitigation is that **nothing may claim audit history exists** — no screen, no doc, no `/audit-logs` route — until the writer does. `GET /audit-logs` should not be added on its own either: a readable empty table is worse than no route, because it looks like a finished feature.

**UI — `packages/ui`, then `apps/admin`** — all five landed

1. `ServerDataTable` — server-driven wrapper over the existing `DataTable`. **Adopted** — the parcels list renders through it now, so it is proven against a real screen. Sort, pager and row range all come from the wrapper; `SortableHead`, `TableFooter` and the bespoke pagination footer are gone.
2. `FormSheetShell` + `useFormSheetState` — one overlay decision. **Applied** — `parcel-create-dialog.tsx` is a sheet now. The dialog's custom close handler was folded into the shell's `onReset`/`onClose` callbacks rather than duplicated: the shell owns overlay lifecycle, and a consumer re-implementing it is the failure mode the component exists to prevent.
3. `ServerFormError` + `FormErrorSummary` + `applyServerFieldErrors` + `useServerErrors` — promoted out of `features/parcels/parcel-form-errors.tsx`, which had exactly one call site and is now just the parcel label map. Transport-agnostic by shape rather than by importing any app's `ApiError`, which is what lets it live in `packages/ui`. **In use.**
4. `useQueryParams` + `usePaginatedListWhere` for TanStack Router, plus `ListSearchBar` / `ListFilterSelect` in `apps/admin`. **In use** — the parcels list's hand-rolled `patch`, debounce, search box and two filter selects are all these now.
5. `ReferenceCombobox` replacing the six raw-ID inputs in `parcel-create-dialog.tsx`; the `hubId` filter added to the list. **In use.**

Also added, not in the original five: `AppToast` (success-only, with one documented `failure` exception for local non-API failures like a refused clipboard write) and `useConfirmation`. `useConfirmation` is built but unused — `CancelParcelDialog` collects a reason, so it is a form, not a confirm.

**Gate:** the parcel-create dialog has zero free-text ID inputs — the six it has today (`senderCustomerId`, `receiverCustomerId`, `originHubId`, `destinationHubId`, `originZoneId`, `destinationZoneId`) are all comboboxes backed by `reference` — and the parcels list has a working `hubId` control. One reference-driven list screen and one reference-driven CRUD screen exist end to end, as the pattern for Phases 1-4.

The six fields above are the whole reason Phase 0 exists, and they set the minimum: a customer search and two list endpoints. Branches, users, riders, and vehicles are speculative until a screen needs them — see §6 for whether to declare them now or when the first picker asks.

#### Where Phase 0 actually stands

Landed and verified:

| Operation                         | Path                                    | Permission       |
| --------------------------------- | --------------------------------------- | ---------------- |
| `admin.reference.listHubs`        | `GET /api/v1/admin/reference/hubs`      | `hubs.view`      |
| `admin.reference.listZones`       | `GET /api/v1/admin/reference/zones`     | `zones.view`     |
| `admin.reference.searchCustomers` | `GET /api/v1/admin/reference/customers` | `customers.view` |

Three rather than the ~7 originally scoped, because three is what the gate needs and each addition is a registry entry plus a handler. The responses are narrow projections — `HubOption` has no coordinates or capacity, `CustomerOption` has no addresses and never joins `customer_addresses`. That is deliberate: a published contract that omits a field cannot be quietly widened later. `limit` is clamped twice, in the DTO and again in the service, because these are hit per keystroke by a picker.

Two decisions that the schema forced rather than that were chosen:

- **Hubs are branch-scoped, zones are not.** `hubs.branch_id` exists, so a branch manager picking an origin hub sees their own network. `zones` has no branch column, so the zone list is company-wide. Verified against `migrate.sql`, and the emitted SQL was inspected to confirm the `branch_id` predicate is actually present rather than dropped.
- **Each endpoint carries its own `*.view` key**, not one blanket `reference.read`, so a role that may look up a hub to book a parcel is not thereby granted the customer list.

Verification: 25 operations in the catalog, `smoke` clean, typecheck green in all six workspaces, and the three reads added to `check:read-paths` — 53/53 against the live schema, covering every `sortBy` value, since `sortBy` arrives from a client and the allowlist is the only thing between it and the SQL. The check itself was passing bare SQL columns and therefore never exercised the broken path; it now uses the published camelCase keys, which is how a client sorting by `createdAt` was caught as a 500.

**The UI half has since landed.** The six IDs are now `ReferenceCombobox` pickers, the list has a `hubId` control gated on `hubs.view`, and the four shared components exist. Verified: typecheck green in six workspaces, all four apps build, `smoke` 25 operations, `check:read-paths` 53/53, and `bun run lint` at the repo's pre-existing 64-file baseline with no new failures.

**The overlay decision is now applied.** `parcel-create-dialog.tsx` was converted from `Dialog` to `FormSheetShell`, which owns the `<form>`, the busy-guarded dismissal, the reset-on-open and the close-cleanup. The dialog's custom close handler was folded into the shell's `onReset`/`onClose` callbacks rather than duplicated — the shell is the place that owns overlay lifecycle, and a consumer that re-implements it is the failure mode the component exists to prevent. `ServerDataTable` is now adopted too: the parcels list renders through it, so sort, pager and row range all come from the wrapper and the bespoke `<Table>` + `SortableHead` + `TableFooter` are gone. `useConfirmation` is still built but unused — `CancelParcelDialog` collects a reason, so it is a form, not a confirm.

**Resolved — the permission gap is closed, in code.** `zones.view` is granted to `BRANCH_MANAGER` in `DEFAULT_ROLE_GRANTS` and documented in `docs/rbac.md`. The seeded role rows themselves still need the normal seed/deployment path to pick it up; nothing was written to the live database.

---

### Phase 1 — Organization & people · ~4-5 days · 6 modules, ~34 operations

The "admin and their staffs" core: who works here, what they may do, which hubs they can see.

| Module      | Ops | Screens                                                        | Notes                                                              |
| ----------- | --- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `branches`  | 4   | **LANDED (API).** list, create/edit sheet                      | regional office; code, district, lat/lng, ACTIVE/INACTIVE          |
| `hubs`      | 4   | **LANDED (API).** list, create/edit                            | ORIGIN/SORTING/TRANSIT/DESTINATION, capacity, MAINTENANCE status   |
| `zones`     | 4   | list, create/edit                                              | geographic pricing areas                                           |
| `users`     | 5   | list, create, edit, reset password, activate/deactivate        | `bootstrap-admin.ts` is currently the only writer of a `users` row |
| `roles`     | 5   | **permission matrix editor**                                   | checkbox grid over all 40 keys                                     |
| `customers` | 6   | list, detail (addresses, parcel history), activate TEMP→ACTIVE | also covers `customer_addresses`                                   |

`branches` and `hubs` are the first two modules and they are landed as API only — the screens are the next step, and they follow the same pattern the parcels list established: a `ServerDataTable` over a registry operation, with the create/edit overlay as a `FormSheetShell`.

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

| #   | Item                          | Why it cannot be deferred                                                                                                                                                                                                                                                                              |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Audit writer**              | Wired into every mutation service. Cheapest on day one, retrofitted expensively. Until it lands, the sidebar's audit claim is false.                                                                                                                                                                   |
| 2   | **Notification dispatch**     | `notifications` is a table with no writer. Trigger it on `parcel_events` writes, which Phases 3-4 produce heavily.                                                                                                                                                                                     |
| 3   | **Redis cache driver**        | OTP and rate limiting are per-process in-memory, so they break across multiple API instances. Blocker for production; not for features.                                                                                                                                                                |
| 4   | **A test runner**             | Zero tests exist. `smoke` catches catalog drift and `check:read-paths` catches bad columns, but **no business logic is covered**. Add vitest + service-level tests as each Phase 1-4 module lands.                                                                                                     |
| 5   | **Per-operation bookkeeping** | Once A1 lands, a new operation is **one registry entry plus one handler** — the policy entry and the spec are generated, so `document.ts` needs no import and `smoke.ts` no id line. Before A1, `apps/api/scripts/smoke.ts:40-63` hardcodes all 22 ids and a missing fragment fails boot on purpose.   |
| 6   | **The namespace guards**      | **Done.** `smoke` asserts no `admin.`-prefixed id is mounted outside `/admin`, that `/admin` carries no non-admin audience, and the same pair for `customer.` / `/customer` — plus that a `/customer` operation requires no permission at all. A prefix is only worth having if something enforces it. |
| 7   | **Document the new system**   | `AGENTS.md` still documents a three-part "add an operation" contract (route + policy, DTOs, OpenAPI entry) and the `openapi/paths/<domain>.openapi.ts` location. Both change under A1/A2. A stale contract is worse than none — it is the file people trust and stop reading.                          |

---

## 6. The Phase 0 decision

**RESOLVED — option 1, narrowed to 3 operations.** One `reference` feature on the `admin` surface: `hubs`, `zones`, `customers`. The six free-text ID fields in `parcel-create-dialog.tsx` need exactly a customer search and two lists, and that is what got built. Branches, users, riders, and vehicles are not speculative-but-free — they are not written at all, and adding one is a registry entry plus a handler, which the registry is what makes cheap.

The other two options were rejected on the same grounds: option 2 splits three tables across two modules and writes the same fragment three times, and option 3 leaves every picker needing its own permission mix while still inventing the response shape later.

What narrowing to 3 did not avoid is recorded in §4: the endpoints took their `*.view` keys from the existing permission catalog, and the catalog has a hole — `BRANCH_MANAGER` holds `parcels.create` but not `zones.view`. Picking a key that already exists is what surfaced it, and that is the argument for reusing the catalog rather than inventing a `reference.read`.

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
