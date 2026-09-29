"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import * as React from "react"

import { Button } from "../components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import {
  DataTable,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
  type DataTableSortDirection,
} from "../components/spectrumui/data-table"

/**
 * Server-driven table.
 *
 * `DataTable` paginates on the client — it slices whatever `data` it is given.
 * That is the right behaviour for a list that already has every row, and the
 * wrong one for an API that pages, so this wrapper takes the page the server
 * returned and renders a server pager around it.
 *
 * The one trap worth naming: **`pageSize` is deliberately not forwarded.** The
 * rows handed to `DataTable` are already one page, so letting it slice again
 * would show `limit` rows of a `limit`-row page — a table that looks broken
 * exactly when the page size stops dividing evenly.
 *
 * Sort is bridged rather than duplicated. `DataTable` speaks
 * `{ columnId, direction }`; the API speaks a `sortBy` string plus a `sort`, so
 * this maps between them. Columns become sortable only when their `id` is in
 * `sortableColumns`, which is what stops the UI offering a sort the endpoint's
 * allowlist would reject.
 */

export type ServerPageMeta = {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export type ServerDataTableProps<T> = Omit<
  DataTableProps<T>,
  "pageSize" | "sort" | "onSortChange" | "defaultSort"
> & {
  /** Rows on the current server page. */
  data: readonly T[]
  meta: ServerPageMeta | undefined
  /** Column ids the API can sort by. Anything else renders unsortable. */
  sortableColumns?: readonly string[]
  sortBy?: string
  sort?: DataTableSortDirection
  onPageChange?: (page: number) => void
  onPageSizeChange?: (limit: number) => void
  onSortChange?: (sortBy: string, sort: DataTableSortDirection) => void
  /** Hide the pager entirely for a list that is never paged. */
  hidePagination?: boolean
  /** Formats the row range. Defaults to `1–25 of 300`. */
  formatTotal?: (total: number) => string
}

export function ServerDataTable<T>({
  data,
  meta,
  sortableColumns,
  sortBy,
  sort,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  hidePagination = false,
  formatTotal,
  columns,
  loading,
  emptyState,
  ...rest
}: ServerDataTableProps<T>) {
  // Map the server's `sortBy` string onto the table's own sort shape, so the
  // correct header paints as active instead of the table falling back to none.
  const tableSort: DataTableSort | null = React.useMemo(() => {
    if (!sortBy || !sort) return null
    return { columnId: sortBy, direction: sort }
  }, [sortBy, sort])

  const sortable = React.useMemo(() => {
    if (!sortableColumns) return columns
    const allowed = new Set(sortableColumns)
    return columns.map((column) =>
      column.sortable && !allowed.has(column.id) ? { ...column, sortable: false } : column,
    )
  }, [columns, sortableColumns])

  function handleSortChange(next: DataTableSort | null) {
    if (!onSortChange) return
    if (!next) {
      // Third click clears on the table's side; the API has no "unsorted",
      // so re-apply the same column ascending. That keeps the cycle
      // asc → desc → asc rather than leaving the header stuck on desc.
      if (sortBy) onSortChange(sortBy, "asc")
      return
    }
    onSortChange(next.columnId, next.direction)
  }

  const total = meta?.totalCount ?? 0
  const limit = meta?.limit ?? 0
  const page = meta?.page ?? 1

  const first = total === 0 ? 0 : (page - 1) * limit + 1
  const last = limit === 0 ? 0 : Math.min(page * limit, total)

  return (
    <div className="space-y-3" data-slot="server-data-table">
      <DataTable
        {...rest}
        data={data}
        columns={sortable as DataTableColumn<T>[]}
        sort={tableSort}
        onSortChange={onSortChange ? handleSortChange : undefined}
        loading={loading}
        emptyState={emptyState}
      />

      {hidePagination || !meta ? null : (
        <div className="flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <span>
              {total === 0
                ? "No results"
                : `${first}–${last} of ${formatTotal ? formatTotal(total) : total.toLocaleString()}`}
            </span>
            {onPageSizeChange ? (
              <Select
                value={String(limit)}
                onValueChange={(value) => onPageSizeChange(Number(value))}
              >
                <SelectTrigger size="sm" className="w-auto" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {onPageChange ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Page {page} of {Math.max(1, meta.totalPages)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={!meta.hasPreviousPage || loading}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={!meta.hasNextPage || loading}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
