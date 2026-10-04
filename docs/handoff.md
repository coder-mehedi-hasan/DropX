# DropX — Session Handoff

**Repo:** `/Users/mehedihasan/project/DropX` (Bun workspace, TypeScript) — branch `remaining-feature`
**HEAD:** `19580d8` — **working tree is dirty: 31 changed paths, nothing committed this session.**
**What just happened:** P0 Batch 1 (Zones + Vehicles) implemented end-to-end and verified. Four pre-existing bugs in shipped code were found and fixed along the way; one of them was the schema-verification harness itself, which had never actually run.

Supersedes the previous handoff (written against an older HEAD). Its remaining open items are carried forward in §3.

---

## 1. Where things stand

### Done and verified this session

Batch 1 of `docs/p0-implementation-plan.md` — 9 operations, all registered in the admin surface and generated into `/openapi.json`:

- `admin.zones.*` — list, read, create, update
- `admin.vehicles.*` — list, read, create, update, `POST /:id/deactivate`

Supporting work: route tree registration, shared form shell, status-enum consolidation, edit + deactivate UI, redirect resolution for the four list screens, and 409 mapping on duplicate codes.

`docs/remaining-features.md` has the Zone and Vehicle checkboxes ticked. The plan's Batch 1 section carries a status note plus two recorded deviations (route files are not per-feature; list state lives in `routes/<feature>-search-params.ts`).

### Gates

| Gate                                      | Result                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `bun run typecheck`                       | green, 4 workspaces                                                                                          |
| `bun run --cwd apps/api check:read-paths` | **82/82** (previous handoff reported 64/64; it was in fact failing 100%)                                     |
| API boot                                  | clean — 46 operations registered, `assertPolicyCatalog` + registry↔handler bijection pass, OpenAPI generates |
| `bunx prettier --check` on new files      | clean                                                                                                        |
| `bun run lint`                            | **red at HEAD**, unrelated to this session — see §3                                                          |

Not run this session: `bun run build`, `bun run db:migrate`, `bun run db:seed`. No browser/E2E verification.

---

## 2. Bugs found and fixed — read this before touching these files

All pre-existing, all shipped, all producing HTTP 500s. They were invisible because the gate in §3 was broken. Full diffs are in the working tree (`git diff`); the reasoning is in the comments added at each fix.

1. **Count-query alias mismatch** — `org.repository.ts` (branches, hubs), `reference.repository.ts` (`listBranchRefs`), plus the two new repositories built `SELECT COUNT(*) … FROM branches` while the WHERE clauses were prefixed `b.`. Any search term or status filter threw `ER_BAD_FIELD_ERROR`. Invisible on an unfiltered list, so it survived.

2. **camelCase interpolated as a column name** — `patchHub` and `patchVehicle` turned `branchId` into `branchId = ?`. Only failed when that specific field was in the payload. Fixed by introducing `apps/api/src/db/updates.ts#buildAssignments`, which requires an exhaustive `Record<K, string>` column map, so a new model field is a type error until its column is mapped. **Use this helper for every `patch*` in the remaining batches** — all 8 others need partial updates.

3. **Nested `WHERE`** — `combineClauses` in both `parcels.repository.ts` and `reference.repository.ts` returned a complete `WHERE (…)` string that callers then wrapped in another `WHERE (…)`. Any query combining a scope clause with a filter was a syntax error. Both now return a bare parenthesised expression; callers prefix the keyword.

4. **DATETIME decoded as a string** — `decodeParcel` / `decodeItem` called `.replace(" ", "T")` on `created_at`. mysql2 returns a `Date` unless the pool requests `dateStrings`, and `db/pool.ts` does not. Every parcel list and read threw a `TypeError`. Now handled by `toUtcDate`, which accepts both shapes. `ParcelRow` / `ParcelItemRow` also claimed `created_at: string`; now `string | Date`.

---

## 3. Known open items

- **`bun run lint` is red at HEAD, repo-wide (110 files).** `.prettierrc` sets `printWidth: 100`, but committed code is wrapped narrower, so the check fails on files this session never touched (`packages/ui/**`, `apps/web/**`, several `docs/*.md`). Only newly created files were formatted. Deciding whether to reformat the repo or relax the config is an open call — do not fold it into a feature diff.
- **`check:read-paths` was structurally broken, now fixed.** Two independent faults: `db` was defined as a property on Hono's `Context`, which does not populate the private var map `c.get()` reads, so every repository got `undefined`; and the script passed `ctx` to repositories that take a `Pool`. It failed identically on all 64 cases, which reads like a schema problem and is not one. **When adding a module, add its read paths to `apps/api/scripts/check-read-paths.ts`** — including the _filtered_ and _sorted_ variants, since bug 1 above only appears with a filter present and a column present in the sort allowlist.
- **Org create sheets still do not close, invalidate, or toast.** `features/org/branch-form-sheet.tsx` and `hub-form-sheet.tsx` call the endpoint and stop — the sheet stays open and the table goes stale. Left alone to keep this diff focused. The zones/vehicles sheets were built correctly (mutation owned by the sheet, toast on success, invalidate, close); converting org is a small follow-up and `components/form-sheet.tsx` is the shared shell to use.
- **`BRANCH_MANAGER`'s `zones.view` grant** — code-only. `DEFAULT_ROLE_GRANTS` in `apps/api/src/shared/auth/permissions.ts` has it; the seeded role rows need the normal seed/deployment path. `bun run db:seed` is idempotent but writes to the database — needs approval.
- **No browser E2E.** Typechecks and boot assertions say nothing about sheet rendering, row-action behaviour, or role-based 403s in the browser.
- **Empty test layer.** Nothing covers business logic; only boot-time drift assertions and `check:read-paths` exist.
- **External API consumer unknown** — the `/api/v1` vs `/api/v2` question remains open.
- **No commit was made this session.** 31 paths are dirty, including the plan and feature-list doc updates.

---

## 4. Next: P0 Batch 2 — Pricing Rules

The plan is `docs/p0-implementation-plan.md`; Batch 2 is "Pricing rules CRUD (6 ops)", depending on zones, which now exist. Follow the pattern Batch 1 established:

- `apps/api/src/modules/<domain>/` — `*.dto.ts`, `*.repository.ts`, `*.service.ts`
- one entry in `apps/api/src/modules/admin/registry.ts`, one handler in `handlers.ts` (they must stay a bijection or boot throws)
- `apps/admin/src/routes/<feature>-search-params.ts`, feature folder under `apps/admin/src/features/`, lazy route + tree line
- new `patch*` functions go through `buildAssignments`
- new read paths go into `check-read-paths.ts`, filtered and sorted variants included

Carry over from Batch 1: sheets own their mutation and are driven by `components/form-sheet.tsx`; status enums live in `apps/api/src/db/models.ts` and are imported by both the API DTOs and the admin; `fromDatabaseError` on writes so a declared 409 is real.

Remaining batches 3–9 (routes/stops, riders, rider locations, pickups, transfers, deliveries, proofs) are listed in the same plan file.

---

## 5. Commands

```
bun run dev            # all four apps via mprocs
bun run typecheck      # tsc --noEmit across every workspace
bun run build          # production build of every app
bun run lint           # Prettier check — red at HEAD, see §3
bun run db:migrate     # apply migrate.sql (idempotent)
bun run db:seed        # seed roles + permission grants — writes
bun run --cwd apps/api check:read-paths   # every SELECT against the real schema
```

`check:read-paths` runs read-only against the live remote database (Aiven Cloud, configured in `apps/api/.env`). It does not need `db:migrate` for the queries as written, but the schema must already be applied. Start the API with `bun run src/index.ts` from `apps/api` to exercise boot assertions or curl `/openapi.json`.

---

## 6. Suggested skills

Call the Skill tool for these before starting Batch 2:

- **`api-modules`** — scaffolding a backend feature module: folder layout, DTO/service/transport checklist, pagination, domain errors. Directly applicable to the new pricing module.
- **`api-patterns`** — feature co-location, list-pagination contract, thin transport, structured domain errors, side effects after write. Read before adding the 6 pricing operations.
- **`api-review`** — backend checklist (TENANT, AUTH, ERR, LAY, PAGE, SIDE). Worth running over the four bug fixes in §2 before committing them.
- **`react-lists`** — URL-driven list pages, `useQueryParams`, `usePaginatedListWhere`, `ServerDataTable`, debounced search. The pricing rules list will be the first screen with two dependent zone pickers.
- **`react-forms`** — schema-first forms, `ServerFormError`, sheet mechanics. Relevant because Batch 2's form has coupled min/max weight fields with a real validation story.
- **`react-overlays`** — `FormSheet`/sheet-open-as-local-state conventions; confirms whether the shared shell in `components/form-sheet.tsx` matches the documented pattern or should be renamed.
- **`react-shadcn`** — UI layering and form-field wrappers, if any new UI component is needed.
- **`graphify`** — if a question comes up about how a module's files relate; run it before guessing at cross-module dependencies.

---

## 7. Reference artifacts

Do not restate these in new docs; read them.

- **Plan:** `docs/p0-implementation-plan.md` — the 9-batch P0 order, per-batch file tables, gates. Batch 1 has a status note.
- **Remaining features:** `docs/remaining-features.md` — prioritised inventory; Zone and Vehicle now ticked.
- **Architecture rules:** `AGENTS.md` — monorepo layout, API conventions, the "adding an operation" contract, architecture rules 1–18.
- **Product plan:** `docs/admin-plan.md` — earlier phased build order (predates the P0 plan; still the source for `org` phase status).
- **Schema:** `apps/api/src/db/migrate.sql` — source of truth for the database.
- **RBAC:** `docs/rbac.md` — roles and the 48 static permission keys.
- **Brand:** `docs/brand-guidelines.md` — required if any Batch 2 UI touches branding.
- **Working tree:** `git diff` and `git status` are the authoritative record of this session's changes.

---

## 8. Redactions

- No `DATABASE_URL`, credentials, hostnames, API keys, or passwords are reproduced here. Connection details live in the repo-root `.env` (gitignored) and `.env.example`.
- No PII.
- Note for the next agent: the database is a **shared remote instance**. Only read-only queries were run. `db:migrate` and `db:seed` write — get explicit approval before running either.
