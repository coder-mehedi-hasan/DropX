# DropX — Session Handoff

**Repo:** `/Users/contenttree/lab/mehedi/dropx` (Bun workspace, TypeScript, `mprocs`)
**Branch:** not recorded this session — run `git branch --show-current` before committing.
**HEAD:** `8cf74d9` — **working tree is clean.** Everything below is committed.
**Supersedes:** the handoff written against `19580d8`, which described Batch 1 only. Items from it
that are still open are carried forward in §6; the rest is closed or fixed and noted as such.

---

## 1. Where things stand

P0 batches 1–4 are implemented and gate-green. Batch 4 (Rider Management) landed this session.
**65 operations registered**, all documented in `/openapi.json`. 27 of 51 planned P0 ops done.

Authoritative status is the plan, not this summary — read it rather than trusting the table here:

- **`docs/p0-implementation-plan.md`** — status checklist, per-batch status notes, and the
  registry-vs-hand-written-routes section. Source of truth for what is done.
- `docs/remaining-features.md` — product surface beyond P0.
- `AGENTS.md` — architecture rules, commands, conventions. **Read this first.**

| Batch | Feature          | Ops | Note                                          |
| ----- | ---------------- | --- | --------------------------------------------- |
| 1     | Zones + Vehicles | 9   | via registry                                  |
| 2     | Pricing Rules    | 6   | hand-written module (§4)                      |
| 3     | Routes + Stops   | 7   | hand-written module; 8th op folded into `PUT` |
| 4     | Rider Management | 5   | via registry; no delete by design             |
| 5–9   | —                | 0   | not started; **Batch 5 now unblocked**        |

---

## 2. Gates as of this session

| Gate                                      | Result                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `bun run typecheck`                       | green, 6 workspaces                                                                            |
| `bun run build`                           | green, 4/4                                                                                     |
| `bun run --cwd apps/api check:read-paths` | **120/120**                                                                                    |
| API boot                                  | clean — 65 ops registered, policy-catalog + registry↔handler bijection pass, OpenAPI generates |
| Unauthenticated probes                    | 401 on every new operation; correct 404 on method-mismatched routes                            |
| `prettier --check` on touched files       | clean                                                                                          |

**`bun run lint` is still red repo-wide (87 files)** — pre-existing, not from this work. See §6.

---

## 3. Findings worth not rediscovering

Each of these cost real time and is still live in the codebase.

### 3.1 `FormLabel` cannot be used outside a bound form field

`FormLabel` and `FormItem` call `useFormField()`, which reads react-hook-form context and **throws**
`useFormField should be used within <FormField>` with no bound field. This crashed the route stops
editor: with zero rows nothing rendered, so it only failed on the first **Add Stop**.

Rows driven by local array state rather than registered fields must use a plain `<label htmlFor>` with
an explicit `id` on the control. `ReferenceCombobox` accepts `id`; `Input` takes it natively. See the
helper comment in `apps/admin/src/features/routes/route-form-sheet.tsx`.

A repo-wide scan found only that one genuine occurrence — the parcel/tracking sheets use shadcn's
`<FormField render={...}>`, which does provide context. Don't re-audit.

### 3.2 Zod 4: `.omit()` / `.partial()` refuse refined schemas

`.omit()` throws on a schema carrying `.refine()`. Keep the field set in an unrefined const and apply
the cross-field check separately to create and update.
`apps/api/src/modules/routes/routes.dto.ts` shows the shape.

### 3.3 `.default()` on a reused enum leaks into reads and PATCHes

A real shipped bug, in **two** modules, which the type system did not catch.

`status: someEnumWithDefault.or(z.literal("")).optional()` looks optional but is not: an absent value
hits the inner `.default()` and becomes `ACTIVE`. Consequences: list endpoints silently filtered to
ACTIVE only, so INACTIVE rows were invisible; a PATCH of one field reset `status` to `ACTIVE` and
`maxWeight` to `null`.

Fix — split the enum: a **no-default** variant for list filters and PATCH (absent must stay absent),
and a `.default()` variant for **create only**. `updatePricingRuleSchema` also lacked `.partial()`, so
PATCH demanded the whole body despite a comment claiming the opposite.
`apps/api/src/modules/zones/zones.dto.ts` is already correct and is the reference. Fixed in
`apps/api/src/modules/pricing/pricing-rules.dto.ts` and `apps/api/src/modules/routes/routes.dto.ts` — **watch for this in Batches 5–9.**

### 3.4 Sort columns never match the client's sort keys

`sortColumnOf` allowlists SQL column names (`r.name`, `v.registration_number`) while clients send
camelCase (`name`, `registrationNumber`), so `sortBy` silently falls back to the tiebreak. No SQL
error, so read-path checks pass and nothing looks broken. Present in zones, vehicles and routes.

**Not fixed — flagged rather than silently changed**, because a shared fix touches several modules.
Cheap fix: a client-sort-key → SQL-column map per repository. Worth doing as one standalone pass.

### 3.5 Port 8000 will lie to you

A leftover `bun run start` / `bun --watch src/index.ts` holds 8000 and answers probes from a stale
build — so a healthy 200 does not prove your code booted. Before trusting any boot probe:

```
pkill -f "bun run start"; pkill -f "bun --watch src/index.ts"; lsof -ti :8000 | xargs kill -9
```

then start fresh and confirm the operation count in the log.

### 3.6 Stray worktree tree inside the repo

`.kilo/worktrees/` is picked up by `bun run lint` and contributes pre-existing warnings. Verify
per-file that a lint warning is actually yours instead of assuming.

---

## 4. The registry "bug" was a misdiagnosis — use the registry

Earlier sessions recorded that `SurfaceHandlers<typeof ADMIN_SURFACE>` mis-maps new feature keys,
which forced Batches 2–3 into standalone hand-written Hono routes.

**That was wrong.** Batch 4 added a `riders` feature to `apps/api/src/modules/admin/registry.ts` + `handlers.ts`; it typechecked,
booted, and generated its own OpenAPI paths with no special handling. The real cause of the earlier
failure was almost certainly a handler-map key not matching the registry feature key — which is
precisely what the boot-time bijection assertion exists to catch.

**Batches 5–9 should use the registry:** one entry in `apps/api/src/modules/admin/registry.ts`, one
handler in `apps/api/src/modules/admin/handlers.ts`. The
registry derives operation id, mounted path, policy registration and OpenAPI operation, so there is no
second file to keep in sync. The Batch 2–3 hand-written modules work — leave them.

---

## 5. Design calls made without confirmation — worth a product owner's sign-off

1. **Batch 4 has no delete op (5, not 6).** A rider owns delivery history (`deliveries`,
   `parcels.rider_id`), so deleting one orphans the ops record. `SUSPENDED` is terminal instead, and
   `setStatus` is its own operation for that reason. Confirm before anyone adds a hard delete.
2. **Batch 3 folded stop add/remove into one `PUT /routes/{id}/stops`** (7 ops, not 8). The DB
   already enforces uniqueness on `(route_id, sequence_no)` and `(route_id, hub_id)`.
3. **Batch 4's `POST /admin/riders` writes two tables** — a `users` row and a `riders` row in one
   transaction, because a rider is both (rule 8) and neither half is useful alone.
4. **Account fields are create-only.** `PATCH /admin/riders/{id}` cannot touch
   `email`/`name`/`password`, deliberately, so two surfaces never write one `users` row.

---

## 6. Open items

Nothing is mid-edit. In priority order.

1. **No authenticated end-to-end pass has ever been run** for Batches 2–4. Every gate so far is
   typecheck / build / read-path / boot / unauth-401. Sheet rendering, row actions and role-based 403s
   are all unverified in a browser.
2. **Batch 4's account half is unproven.** Verify a created rider can actually sign in at
   `apps/riders` with that email and password. Highest-value single check outstanding.
3. **§3.4 sort columns** — not fixed, by choice.
4. **`bun run lint` red repo-wide (87 files).** `.prettierrc.json` sets `printWidth: 100`; committed
   code is wrapped narrower, so it fails on files nobody touched (`packages/ui/**`, `apps/web/**`,
   `docs/*.md`). Only newly created files were formatted. Whether to reformat the repo or relax the
   config is an open call — **do not fold it into a feature diff.**
5. **Batches 5–9** — see plan. Batch 5 (rider locations, 2 ops) is unblocked and the smallest;
   `rider_locations` is already in `migrate.sql` and `RIDER_LOCATION_UPDATE` exists. Batches 5 and 9
   both append to `apps/api/src/modules/jobs/jobs.routes.ts` (3 existing ops).
6. **Empty test layer.** Nothing covers business logic; only boot-time drift assertions and
   `check:read-paths` exist.
7. **`BRANCH_MANAGER`'s `zones.view` grant is code-only.** `DEFAULT_ROLE_GRANTS` has it; the seeded
   role rows need the normal seed path. `bun run db:seed` is idempotent but writes — needs approval.
8. **External API consumer unknown** — the `/api/v1` vs `/api/v2` question is still open.
   `API_BASE_PATH` is currently `/api/v1` (`apps/api/src/modules/index.ts`).

**Closed since the last handoff:** the org create sheets now close, invalidate and toast (verified —
`apps/admin/src/features/org/branch-form-sheet.tsx` and `hub-form-sheet.tsx` each have all three); the stale repo path and dirty
tree it reported are gone.

---

## 7. Commands

```
bun run dev            # all four apps via mprocs
bun run typecheck      # tsc --noEmit across every workspace
bun run build          # production build of every app
bun run lint           # Prettier check — red at HEAD, see §6
bun run db:migrate     # apply migrate.sql (idempotent)
bun run db:seed        # seed roles + permission grants — WRITES
bun run --cwd apps/api check:read-paths   # every SELECT against the real schema
```

`check:read-paths` runs read-only against the live **remote shared** database, configured in
`apps/api/.env`. The schema must already be applied. Start the API from `apps/api` to exercise boot
assertions or curl `/openapi.json`.

**When adding a module, add its read paths to `apps/api/scripts/check-read-paths.ts`** — including the
_filtered_ and _sorted_ variants. A bad column only throws when the column is actually referenced.

After any web build, `git checkout apps/web/next-env.d.ts` — the build rewrites it.

---

## 8. Suggested skills

Call these with the Skill tool before starting the relevant work.

- **`react-patterns`** — first, for any Batches 5–9 admin screen. The list page and form sheet this
  session followed it (URL-driven list state, `useFormSheetState`, split create/edit sheets when the
  edit schema is narrower, `AppToast` for success only). It is why the stops and rider editors look
  the way they do.
- **`react-overlays`** — if Batch 5/6/7 add sheets or dialogs: `FormSheetShell`, remount keys,
  `useConfirmation` for deletes.
- **`react-lists`** — the `routes/<feature>-search-params.ts` pattern: schema + defaults + exported
  type consumed by both `useQueryParams` and `resolveRedirect`. Batches 5–9 each add one.
- **`react-shadcn`** — before adding anything to `packages/ui`. Explains the `ui/` vs `form/` layering
  and why `FormInputSlug` exists.
- **`react-ux`** — polishing the new screens; the availability quick-set and status badges are worth a
  hierarchy pass.
- **`api-patterns`** and **`api-review`** — building the Batch 5–9 modules, and as a retrospective
  pass over Batch 2–4. `api-review` is the TENANT/AUTH/ERR/LAY/PAGE/SIDE list and would have caught
  §3.3 before it shipped.
- **`api-modules`** — scaffolding a module folder; read alongside
  `apps/api/src/modules/riders/` and `apps/api/src/modules/routes/`.
- **`i-have-adhd`** — the user's display preference is active. Keep output action-first, numbered,
  and end on one concrete next step.

Do **not** load `react-forms` reflexively: newer screens use `useState` + Zod + `BoundFormField` +
`FormSheet`, not RHF `Controller`. Match the neighbouring file.

---

## 9. Reference artifacts

Do not restate these in new docs; read them.

- **Plan:** `docs/p0-implementation-plan.md` — 9-batch P0 order, per-batch file tables, gates,
  per-batch status notes. Batches 1–4 carry status notes.
- **Remaining features:** `docs/remaining-features.md` — prioritised inventory.
- **Architecture rules:** `AGENTS.md` — monorepo layout, API conventions, the "adding an operation"
  contract, architecture rules 1–19.
- **Product plan:** `docs/admin-plan.md` — earlier phased build order (predates the P0 plan; still the
  source for `org` phase status).
- **Schema:** `apps/api/src/db/migrate.sql` — source of truth for the database.
- **RBAC:** `docs/rbac.md` — roles and the static permission keys.
- **ER diagram:** `docs/er-diagram.md`.
- **Brand:** `docs/brand-guidelines.md` — required if any UI touches branding.
- **Commits** are the authoritative record of this session's changes: `d5a1ec6` pricing,
  `3dba03c` routes, `8f0580c` plan status, `8cf74d9` riders.

---

## 10. Redactions and safety

- No `DATABASE_URL`, credentials, hostnames, API keys or passwords are reproduced here. Connection
  details live in the gitignored `apps/api/.env` and its `.env.example`.
- No PII.
- **Credentials were exposed in an earlier session transcript** (values from `apps/api/.env`, plus an
  admin JWT). Treat the database password, mail password and `BOOTSTRAP_TOKEN` as compromised and
  rotate them. Discard the token — it expired long ago and no fresh one has been issued.
- The database is a **shared remote instance**. Only read-only queries were run. `db:migrate` and
  `db:seed` write — get explicit approval before running either.
