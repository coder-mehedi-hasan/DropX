# Lists — URL-driven

**Default:** `useQueryParams` + `defaultPaginatedListParams` + `usePaginatedListWhere` + `ServerDataTable`.  
Sheet open / edit target = **local `useState`**, not URL.

## Contract

```
URL query params  →  list where/input  →  server
        ↑                                      │
        └──── table / toolbar callbacks ←──────┘
```

| Concern | Default |
| --- | --- |
| Page / page size | `page`, `limit` (1-indexed page) |
| Sort | `sortBy`, `sort` (`Asc` / `Desc`) |
| Search | `search` in URL immediately; **debounce when building the API where** (~300ms) |
| Structured filters | optional `filters` string in URL (`useListFilterQuery`) |
| Sheet open / editing entity | component state |

Changing search, filters, sort, or page size resets `page` to `1`.

## Page skeleton

```tsx
const [queryParams, setQueryParams] = useQueryParams({
  ...defaultPaginatedListParams,
  // filters: "",  // add when the list has structured filters
});

const input = usePaginatedListWhere(queryParams, {
  searchFields: CUSTOMER_SEARCH_FIELDS,
});

const [sheetOpen, setSheetOpen] = useState(false);
const [editOpen, setEditOpen] = useState(false);
const [editCustomer, setEditCustomer] = useState<CustomerFormValues | null>(null);

const { serverErrors, clearServerErrors, setServerError } = useServerErrors();

return (
  <div className="flex flex-col gap-6">
    <DashboardPageHeader title="Customers" description="…" />

    <ServerFormError
      errors={serverErrors}
      title="Unable to load or update customers"
      onDismiss={clearServerErrors}
    />

    <ListPageToolbar
      search={
        <ListSearchBar
          value={queryParams.search}
          onChange={(search) => setQueryParams({ search, page: 1 })}
        />
      }
      action={
        <Button onClick={() => setSheetOpen(true)}>Create customer</Button>
      }
    />

    <ServerDataTable
      columns={columns}
      data={nodes}
      totalCount={meta?.totalCount ?? 0}
      page={queryParams.page}
      pageSize={queryParams.limit}
      sortBy={queryParams.sortBy}
      sort={queryParams.sort}
      onPageChange={(page) => setQueryParams({ page })}
      onPageSizeChange={(limit) => setQueryParams({ limit, page: 1 })}
      onSortChange={handleSort}
      loading={query.isLoading}
      onRowClick={(row) => openDetails(row._id)}
    />

    <CustomerFormSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      mode="create"
      onSuccess={() => void query.refetch()}
    />
    <CustomerFormSheet
      open={editOpen}
      onOpenChange={setEditOpen}
      mode="update"
      customer={editCustomer}
      onSuccess={() => void query.refetch()}
    />
  </div>
);
```

## Defaults

```ts
export const defaultPaginatedListParams = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  sortBy: "createdAt",
  sort: SortType.Desc,
  search: "",
};
```

## Search debounce

Write the URL on every keystroke; debounce only the value used for the server request (so the input stays snappy and shareable):

```ts
const debouncedSearch = useDebouncedValue(listParams.search, 300);
// build where/input with debouncedSearch + searchFields
```

## Filters (when needed)

```tsx
const [queryParams, setQueryParams] = useQueryParams({
  ...defaultPaginatedListParams,
  filters: "",
});
const { filters: _filters, ...listParams } = queryParams;
const { filterQuery, apiFilters, onFilterQueryChange } = useListFilterQuery(
  queryParams,
  setQueryParams,
  filterFields,
);
const where = usePaginatedListWhere(listParams, {
  searchFields: PRODUCT_SEARCH_FIELDS,
  filters: apiFilters,
});
```

## Table actions

- Row actions that shouldn’t trigger `onRowClick`: call `stopTableRowClick` (or `e.stopPropagation()`).
- Destructive delete: `useConfirmation` → mutate; list-level failures use `ServerFormError` above the table, not an error toast.

## Portable fallback

If the project lacks `useQueryParams`, keep the same **param names and behaviors** with any router’s search API (`URLSearchParams` parse/write).

## Anti-patterns

- Page/sort/search only in `useState` (not shareable)
- Putting sheet-open in the URL for routine CRUD
- Debouncing by delaying URL writes (input and URL drift)
- Empty state identical to error
