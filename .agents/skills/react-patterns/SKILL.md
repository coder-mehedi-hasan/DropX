---
name: react-patterns
description: >-
  Core React UI guideline for product apps — URL-driven lists,
  FormSheetShell CRUD, useState+Zod forms, ServerFormError, AppToast for
  success only, visual hierarchy/UX. RHF as alternate. Use when building or
  reviewing React list pages, forms, sheets, or CRUD UI.
---

# React Patterns

Portable React UI contracts for product apps. Prefer the host project’s existing kit; don’t rewrite stacks unprompted. Default samples use controlled+Zod forms; RHF is an alternate where the host already uses it.

## Pattern map

| Pattern | Use when | Deep dive |
| --- | --- | --- |
| Lists | Paginated tables — URL params + ServerDataTable | `react-lists` · [references/lists.md](references/lists.md) |
| Forms | Create/edit — controlled+Zod (default) | `react-forms` · [references/forms.md](references/forms.md) |
| Overlays | FormSheetShell, confirms | `react-overlays` · [references/overlays.md](references/overlays.md) |
| Data ops | Mutations, cache, server banner, AppToast | [references/data-ops.md](references/data-ops.md) |
| Components | Share only when shared — no premature abstractions | [references/components.md](references/components.md) |
| shadcn | ui/form/reui layers, CLI add, FormField wraps | `react-shadcn` · [references/shadcn.md](references/shadcn.md) |
| UX | Hierarchy, spacing, type, empty states | `react-ux` · [references/ux.md](references/ux.md) |
| Hygiene | Effects, derived state, keys | [references/hygiene.md](references/hygiene.md) |
| Review | PR against these contracts | `react-review` |

## Core principles

1. **URL owns list state** (`page`, `limit`, `sortBy`, `sort`, `search`, optional `filters`). Sheet open / edit entity = component state.
2. **Sheets for simple CRUD** — `FormSheetShell` + `useFormSheetState` + remount `key`; full page for heavy forms.
3. **Schema-first forms** — default: `useState` + `safeParse` + `FormField*`. Alternate: RHF + `Controller`.
4. **Honest async UX** — loading / empty / error. Saves: clear → validate → mutate; `onError` → **top `ServerFormError`**; success → `AppToast.success` then close. Never toast API failures.
5. **Confirm destructive actions** — `useConfirmation`.
6. **Visual hierarchy** — soft secondaries, spacing scale, fewer borders, designed empty states (see [references/ux.md](references/ux.md)).
7. **Share only when shared** — start feature-local; don’t invent `components/SharedX` for one call site. Once shared, extend by composition (open/closed) — see [references/components.md](references/components.md).
8. **shadcn: wrap, don’t fork** — CLI into `ui/`; forms use `FormField*` (see [references/shadcn.md](references/shadcn.md)).
9. **Adapt to the host** — don’t invent a second list/form kit when one exists.

## Mini example

```tsx
const [queryParams, setQueryParams] = useQueryParams({ ...defaultPaginatedListParams });
const input = usePaginatedListWhere(queryParams, { searchFields: CUSTOMER_SEARCH_FIELDS });
const [sheetOpen, setSheetOpen] = useState(false);

<ListSearchBar
  value={queryParams.search}
  onChange={(search) => setQueryParams({ search, page: 1 })}
/>
<ServerDataTable page={queryParams.page} pageSize={queryParams.limit} /* ... */ />

<CustomerFormSheet
  open={sheetOpen}
  onOpenChange={setSheetOpen}
  mode="create"
  onSuccess={() => void query.refetch()}
/>
```

## Decision cheatsheet

| Situation | Prefer |
| --- | --- |
| List filters/search/page | URL (`useQueryParams`) |
| Sheet open | Component state |
| Simple create/edit | `FormSheetShell` |
| Long multi-section entity | Full-page form |
| Destructive confirm | `useConfirmation` |
| API failure | `ServerFormError` (not error toast) |
| Save success | `AppToast.success` |
| Noisy / flat UI | Hierarchy + spacing rules in `react-ux` |
| New UI abstraction | Feature-local first — [components.md](references/components.md) |

## Adapters

| Contract | Default | Alternate |
| --- | --- | --- |
| List URL | `useQueryParams` + `usePaginatedListWhere` | Any search-params API |
| Forms | `useState` + `safeParse` | RHF + `Controller` |
| Sheets | `FormSheetShell` | Controlled Sheet + `formId` |
| Server errors | `useServerErrors` + `ServerFormError` | `useState` + `FormError` |
| Design system | shadcn `ui/` + `FormField*` wraps | See [shadcn.md](references/shadcn.md) |

See [references/adapters.md](references/adapters.md).
