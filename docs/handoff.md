# DropX — Session Handoff

**Repo:** `/Users/contenttree/lab/mehedi/dropx` (Bun workspace, TypeScript)
**Current HEAD:** `03d7cef` — working tree clean
**What just shipped:** Phase 0 complete; Phase 1 `org` module (branches + hubs) landed with API and UI.

---

## 1. Where things stand

### Phase 0 — complete
- Registry-backed operation surfaces (`defineSurface`/`mountSurface`) on the `admin` and `customer` namespaces. No hand-written parcel routes remain.
- `reference` module: 3 endpoints (hubs, zones, customers) for pickers.
- UI gate: six `ReferenceCombobox` pickers in the parcel create dialog; `hubId` filter on the parcels list; overlay decision applied (`FormSheetShell`); `ServerDataTable` adopted.
- Commit `ef13de6`.

### Phase 1 — in progress
- `org` module: branches and hubs, full CRUD (8 operations), inlined into `ADMIN_SURFACE`.
- Screens landed: branches list + create sheet, hubs list + create sheet (`03d7cef`).
- Remaining Phase 1: `zones`, `users`, `roles`, `customers`.

### Verified (all green)
- `bun run typecheck` — 6 workspaces
- `bun run --cwd apps/api check:read-paths` — 64/64
- `bun run build` — 4 apps
- `bun run lint` — at the repo's pre-existing baseline, no new failures

---

## 2. Known open items

- **`useConfirmation`** — built, unused. Correctly so: no delete operation exists in the admin UI yet; the cancel flow is a reason form, not a confirm.
- **`BRANCH_MANAGER`'s `zones.view` grant** — code-only. `DEFAULT_ROLE_GRANTS` in `apps/api/src/shared/auth/permissions.ts` has it; the seeded role rows need the normal seed/deployment path. `bun run db:seed` is idempotent (`INSERT IGNORE` + orphan detection) but writes to the database — needs approval.
- **No browser E2E.** Builds and typechecks prove nothing about sheet rendering, picker selection, or role-based 403s.
- **Empty test layer.** The boot-time policy/OpenAPI assertions and `check:read-paths` catch drift; no business logic is covered.
- **External API consumer unknown** — the `/api/v1` vs `/api/v2` question remains open.

---

## 3. Commands

```
bun run dev            # all four apps via mprocs
bun run typecheck      # tsc --noEmit across every workspace
bun run build          # production build of every app
bun run lint           # Prettier check
bun run db:migrate     # apply migrate.sql (idempotent)
bun run db:seed        # seed roles + permission grants
bun run --cwd apps/api check:read-paths   # every SELECT against the real schema
```

`check:read-paths` needs `db:migrate` first. It runs against the live database read-only — it caught a real bug this session (`hubs` had no `phone` column; the entity did).

---

## 4. Suggested skills

Call the Skill tool for these before starting the next piece of work:

- **`api-modules`** — scaffolding a backend feature module (folder layout, DTO/service/transport checklist, tenancy, auth catalog, pagination, domain errors). Use for `zones`, `users`, `roles`, `customers`.
- **`api-patterns`** — framework-agnostic API guideline (feature co-location, validated inputs, list pagination contract, thin transport, structured domain errors, auth policies, side effects after write). Use when building or reviewing backend features.
- **`api-review`** — backend review checklist (TENANT, AUTH, ERR, LAY, PAGE, SIDE). Use when reviewing API PRs or modules.
- **`react-patterns`** — core React UI guideline (URL-driven lists, FormSheetShell, useState+Zod forms, ServerFormError, AppToast success-only, confirms). Use for the remaining Phase 1 screens.
- **`react-forms`** — schema-first React forms (useState + Zod safeParse + FormField* + ServerFormError + FormSheetShell). Use for create/edit sheets.
- **`react-shadcn`** — how to use shadcn/ui in this repo (ui/ vs form/ vs reui layers, FormField wrappers, cn(), CSS variables). Use when adding or reviewing UI components.
- **`react-ux`** — visual UX guidelines (hierarchy, spacing, type, color, empty states, fewer borders). Use when polishing screens.

---

## 5. Reference artifacts

- **Plan:** `docs/admin-plan.md` — the phased build order, gates, and decisions. Status table says Phase 0 complete; Phase 1 `org` rows marked LANDED (API + UI).
- **Architecture rules:** `AGENTS.md` — monorepo layout, commands, API conventions, the "adding an operation" contract.
- **RBAC:** `docs/rbac.md` — roles, permission keys, enforcement.
- **Schema:** `migrate.sql` — source of truth for the database.
- **Domain map:** `docs/overview.md` — product lifecycle and portals.
- **Session notes:** `docs/handoff.md` — point-in-time notes, may be stale.

## 6. Redactions

- Database credentials and the `DATABASE_URL` are not reproduced here. The remote is Aiven Cloud; only read-only queries were authorized. Do not run `db:migrate`, `db:seed`, or any write without explicit approval.
- No API keys, passwords, or PII appear in this document.
