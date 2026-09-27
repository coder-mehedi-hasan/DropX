---
name: react-lists
description: >-
  URL-driven React list pages — useQueryParams, usePaginatedListWhere,
  ServerDataTable, debounced search in the where builder, filters string,
  sheet open as local state. Use when building tables/grids or shareable list URLs.
---

# React Lists

Parent: `react-patterns`. Full samples: [lists.md](../react-patterns/references/lists.md).

## Workflow

1. `useQueryParams({ ...defaultPaginatedListParams })` (+ `filters: ""` if needed).
2. `usePaginatedListWhere(params, { searchFields, filters? })` — search debounced here.
3. `ServerDataTable` controlled from `queryParams`.
4. Toolbar: `ListSearchBar` writes URL with `page: 1`.
5. Sheet open / edit entity = `useState`, not URL.
6. `onSuccess` on sheets → `query.refetch()`; list API errors → `ServerFormError` above table.

## Skeleton

```tsx
const [queryParams, setQueryParams] = useQueryParams({
  ...defaultPaginatedListParams,
});
const input = usePaginatedListWhere(queryParams, {
  searchFields: CUSTOMER_SEARCH_FIELDS,
});
const [sheetOpen, setSheetOpen] = useState(false);

<ListSearchBar
  value={queryParams.search}
  onChange={(search) => setQueryParams({ search, page: 1 })}
/>

<ServerDataTable
  data={nodes}
  totalCount={meta?.totalCount ?? 0}
  page={queryParams.page}
  pageSize={queryParams.limit}
  sortBy={queryParams.sortBy}
  sort={queryParams.sort}
  onPageChange={(page) => setQueryParams({ page })}
  onPageSizeChange={(limit) => setQueryParams({ limit, page: 1 })}
  onSortChange={handleSort}
/>

<CustomerFormSheet
  open={sheetOpen}
  onOpenChange={setSheetOpen}
  mode="create"
  onSuccess={() => void query.refetch()}
/>
```

## URL params

| Param | Role |
| --- | --- |
| `page`, `limit` | Pagination |
| `sortBy`, `sort` | Server sort |
| `search` | Immediate URL write; debounced for API |
| `filters` | Optional structured filters string |

## Anti-patterns

- List state only in `useState`
- Sheet-open in the URL for routine CRUD
- Debouncing by delaying URL updates
- Error toast instead of list-level `ServerFormError`

## Done checklist

- [ ] URL owns page/sort/search(/filters)
- [ ] Debounce in where builder, not by starving the URL
- [ ] Controlled `ServerDataTable` (or host equivalent)
- [ ] Sheet state local; refetch on form success
