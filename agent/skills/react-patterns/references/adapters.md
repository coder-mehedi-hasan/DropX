# Adapters — map contracts to host kits

**Default** when scaffolding: controlled+Zod sheets + URL lists. Use RHF only when the host already does.

## Lists

| Concern | Default kit | Portable fallback |
| --- | --- | --- |
| URL sync | `useQueryParams` | Router `useSearchParams` / `URLSearchParams` |
| Defaults | `defaultPaginatedListParams` | Same shape: page, limit, sortBy, sort, search |
| Where builder | `usePaginatedListWhere` (+ debounced search) | Build where/input yourself; debounce search for the request |
| Table | `ServerDataTable` | Any controlled table |
| Filters | `useListFilterQuery` + `filters` param | One URL param per filter or encoded string |

## Forms

| Host | Pattern |
| --- | --- |
| **Default** sheet CRUD | `useState` + `safeParse` + `FormField*` + `FormSheetShell` |
| **RHF** | RHF + `zodResolver` + `Controller` → `FormField*` |
| Settings pages that already use RHF | Keep RHF — don’t rewrite |

## Feedback

| Event | Default |
| --- | --- |
| Success | `AppToast.success` |
| API failure | `useServerErrors` + `ServerFormError` (not error toast) |
| Destructive | `useConfirmation` |

## Overlays

`FormSheetShell` + `useFormSheetState` (`formId`, footer submit, `onPendingChange`). Remount form with `key`. See [overlays.md](overlays.md).
