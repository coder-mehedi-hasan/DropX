import { useCallback, useMemo } from "react"
import { useNavigate } from "@tanstack/react-router"

import { useDebouncedValue } from "./use-debounced-value"

/**
 * URL-owned list state.
 *
 * Page, page size, sort and search all live in the address bar, so a list is
 * shareable and survives a refresh — which is the whole reason this is not
 * `useState`. Two rules follow from that and both are enforced here rather than
 * repeated at each call site:
 *
 * 1. **Every change resets to page 1 except paging itself.** Page 4 of a
 *    newly-narrowed result set is empty, and an empty table reads as "no
 *    results" rather than "you are past the end".
 * 2. **The URL takes the keystroke; the debounce is only applied to the
 *    request.** Delaying the URL write would make the address bar lag behind the
 *    field, and a copied link would capture a half-typed search.
 *
 * The whole validated search object is written on each patch rather than a
 * partial one. TanStack Router merges, so omitting a key keeps its old value —
 * which is right for navigation and wrong for filters, where clearing a filter
 * has to actually clear it.
 */

export const DEFAULT_PAGE_SIZE = 20

export const defaultPaginatedListParams = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  sortBy: "",
  sort: "asc",
  search: "",
} as const

export type PaginatedListParams = {
  page: number
  limit: number
  sortBy: string
  sort: "asc" | "desc"
  search: string
}

/**
 * Typed read/patch pair for a route's search params.
 *
 * `to` is the route path; `search` is the already-validated object the route
 * handed the page. Validation stays in the route's own schema so a hand-edited
 * link degrades to defaults before it reaches here.
 */
export function useQueryParams<TSearch extends object>(to: string, search: TSearch) {
  const navigate = useNavigate()

  const patch = useCallback(
    (next: Partial<TSearch>, options?: { keepPage?: boolean }) => {
      void navigate({
        to,
        search: {
          ...search,
          ...next,
          ...(options?.keepPage ? {} : { page: 1 }),
        } as TSearch,
      })
    },
    [navigate, to, search],
  )

  return [search, patch] as const
}

/**
 * The params a list query should actually run with.
 *
 * Returns the same object with `search` debounced, and nothing else changed —
 * filters, sort and page are passed straight through so nothing is accidentally
 * frozen. Empty search collapses to `""` rather than staying `undefined`, which
 * keeps the query key stable: a filter chip being added and removed should not
 * read as a different query.
 */
export function usePaginatedListWhere<T extends { search?: string }>(
  params: T,
  options?: { debounceMs?: number },
): T {
  const debounced = useDebouncedValue((params.search ?? "").trim(), options?.debounceMs ?? 300)

  return useMemo(() => ({ ...params, search: debounced }), [params, debounced])
}

/**
 * Query key for a list.
 *
 * Derived rather than hand-written so a filter added to the where-builder cannot
 * be forgotten in the key — a mismatch there is a stale-cache bug that shows up
 * as one filter's results appearing under another's.
 */
export function listQueryKey<T extends Record<string, unknown>>(
  name: string,
  params: T,
): readonly [string, T] {
  return [name, params] as const
}
