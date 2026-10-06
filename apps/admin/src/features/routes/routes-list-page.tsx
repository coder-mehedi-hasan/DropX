import { useQuery } from "@tanstack/react-query"
import { Pencil, Plus, Route as RouteIcon } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ServerDataTable,
  useFormSheetState,
  type DataTableColumn,
} from "@dropx/ui"
import { RECORD_STATUSES } from "@dropx/types"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listRoutes } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import { type Route } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { RoutesSearch } from "@/routes/routes-search-params"
import { RouteFormSheet } from "./route-form-sheet"

const ROUTE_SORT_COLUMNS = ["name", "code", "status", "createdAt"] as const

export function RoutesListPage({ search }: { search: RoutesSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("routes.manage")

  const sheet = useFormSheetState<string>()
  const [editing, setEditing] = useState<Route | null>(null)

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      status: where.status as RoutesSearch["status"],
    }),
    [where.page, where.limit, where.sortBy, where.sort, where.search, where.status],
  )

  const query = useQuery({
    queryKey: ["routes", params],
    queryFn: () => listRoutes(params),
  })

  const [, patch] = useQueryParams<RoutesSearch>("/routes", search)

  const meta = query.data?.meta
  const nodes = query.data?.nodes ?? []

  const serverMeta = useMemo(
    () =>
      meta
        ? {
            page: meta.currentPage,
            limit: search.limit,
            totalCount: meta.totalCount,
            totalPages: meta.totalPages,
            hasNextPage: meta.hasNextPage,
            hasPreviousPage: meta.hasPreviousPage,
          }
        : undefined,
    [meta, search.limit],
  )

  const columns = useMemo<DataTableColumn<Route>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (route) => <span className="font-medium">{route.name}</span>,
        value: (route) => route.name,
      },
      {
        id: "code",
        header: "Code",
        cell: (route) => <span className="font-mono text-xs">{route.code}</span>,
        value: (route) => route.code,
      },
      {
        id: "status",
        header: "Status",
        cell: (route) =>
          route.status === "ACTIVE" ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
        value: (route) => route.status,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (route) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(route.createdAt)}</span>
        ),
        value: (route) => route.createdAt,
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              align: "end" as const,
              cell: (route: Route) => (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${route.name}`}
                  onClick={() => {
                    setEditing(route)
                    sheet.openFor(route.id)
                  }}
                >
                  <Pencil />
                  Edit
                </Button>
              ),
            },
          ]
        : []),
    ],
    [canManage, sheet.openFor],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Network"
        title="Routes"
        description="Hub-to-hub routes and their ordered stops."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                sheet.openNew()
              }}
            >
              <Plus />
              New route
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load routes"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search routes"
                placeholder="Name or code"
              />
            </div>
            <ListFilterSelect
              className="w-40"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={RECORD_STATUSES.map((status) => ({
                value: status,
                label: status === "ACTIVE" ? "Active" : "Inactive",
              }))}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(route) => route.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof ROUTE_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={ROUTE_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={RouteIcon}
                title="No routes match these filters"
                description={
                  search.search || search.status
                    ? "Try a different search, or clear the filters."
                    : "No routes yet. Create the first one."
                }
                action={
                  canManage ? (
                    <Button
                      onClick={() => {
                        setEditing(null)
                        sheet.openNew()
                      }}
                    >
                      <Plus />
                      New route
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as RoutesSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <RouteFormSheet
        key={sheet.key}
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        route={editing}
      />
    </div>
  )
}
