---
name: react-review
description: >-
  Review a React PR against react-patterns — URL lists, FormSheetShell,
  useState+Zod forms, ServerFormError, AppToast success-only, confirms,
  visual hierarchy/UX. Use when reviewing frontend PRs or asking for a
  react-review.
---

# React Review

Review against `react-patterns`. Don’t invent stack migrations (e.g. “rewrite to RHF”) unless the PR already does that or the host already uses RHF.

## Process

1. Identify surface: list, form, overlay, data ops, or mixed.
2. Walk the checklist; cite file paths.
3. Severity: **Blocker** / **Should fix** / **Nit**.
4. Skip irrelevant items.

## Checklist

### Lists

- [ ] Page/sort/search(/filters) in URL
- [ ] Search: URL updates immediately; API where debounced
- [ ] Sheet open / edit entity not in URL
- [ ] Loading / empty / error distinct; list errors use `ServerFormError`
- [ ] Controlled table (`ServerDataTable` or host equivalent)

### Forms

- [ ] Matches host convention (controlled+Zod vs RHF)
- [ ] One create+edit path (`mode` and/or entity)
- [ ] Hydrate / remount on open
- [ ] Error order: server banner → form errors → fields
- [ ] Submit errors keep the form/sheet open

### Overlays

- [ ] `FormSheetShell` (or host sheet) + `formId` / remount `key`
- [ ] Destructive via `useConfirmation`
- [ ] Focus/Esc sane

### Data ops

- [ ] Cache keys / refetch after success
- [ ] Request throws; `onError` → server banner
- [ ] `AppToast` for success only — not API failures
- [ ] Errors normalized (no technical noise)

### Hygiene

- [ ] No unnecessary sync `useEffect` for derived values
- [ ] Stable list keys (entity ids)
- [ ] No single-use “shared” components — start feature-local ([components.md](../react-patterns/references/components.md))
- [ ] Shared UI extended by wrap/compose, not one-off edits inside primitives
- [ ] shadcn: no casual `ui/` forks; fields via `FormField*` ([shadcn.md](../react-patterns/references/shadcn.md))

### UX

- [ ] Clear primary action; secondaries de-emphasized
- [ ] Spacing groups related fields; not ambiguous
- [ ] Empty state designed (message + CTA)
- [ ] Status not color-only
- [ ] Borders not used where space/bg would do

## Output format

```markdown
## Verdict
Approve | Approve with nits | Request changes

## Findings
- **Blocker:** …
- **Should fix:** …
- **Nit:** …

## What’s solid
- …
```
