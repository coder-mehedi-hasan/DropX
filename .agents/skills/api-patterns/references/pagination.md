# Pagination — one list contract

## Request (conceptual)

| Field | Meaning |
| --- | --- |
| `page` | 1-indexed page |
| `limit` / `pageSize` | Page size (define a **max**; avoid unbounded) |
| `sort` / `sortBy` | Sort direction + field |
| `filters` | Structured filters (key / operator / value) and/or search |

Hosts may rename fields — keep **one shape per API surface**.

```ts
type ListQuery = {
  page?: number; // default 1
  limit?: number; // default 10; cap e.g. 100
  sortBy?: string;
  sort?: "asc" | "desc";
  filters?: FilterRule[];
  search?: string;
};
```

## Response (conceptual)

```ts
type Page<T> = {
  nodes: T[];
  meta: {
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
  };
};
```

Some hosts use `data` instead of `nodes`, or `meta.page` — **pick one and stick to it** across features.

## Rules

- Apply **tenant scope** before/with filters.
- Default sort when client omits one (e.g. `createdAt desc`).
- Document special cases (`limit === -1` = all) or forbid them.
- Empty list → `{ nodes: [], meta: { totalCount: 0, … } }`, not an error.

## Anti-patterns

- Returning raw arrays with no meta
- Different pagination shapes per feature
- Unbounded `limit` from the client
- Sorting on unindexed arbitrary client fields without allowlisting
