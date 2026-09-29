import { useQuery } from "@tanstack/react-query"
import { Plus, Warehouse } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ServerDataTable,
  type DataTableColumn,
} from "@dropx/ui"
import { HUB_STATUSES, HUB_TYPES } from "@dropx/db/entities"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { createHub, listHubs } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import { type Hub } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { HubsSearch } from "@/routes/org-search-params"

import { HubFormSheet } from "./hub-form-sheet"

const HUB_SORT_COLUMNS = ["name", "code", "type", "status", "createdAt"] as const

export function HubsListPage({ search }: { search: HubsSearch }) {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("hubs.manage")

  const [createOpen, setCreateOpen] = useState(false)

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      type: where.type as HubsSearch["type"],
      status: where.status as HubsSearch["status"],
      branchId: where.branchId,
    }),
    [
      where.page,
      where.limit,
      where.sortBy,
      where.sort,
      where.search,
      where.type,
      where.status,
      where.branchId,
    ],
  )

  const query = useQuery({
    queryKey: ["hubs", params],
    queryFn: () => listHubs(params),
  })

  const [, patch] = useQueryParams<HubsSearch>("/hubs", search)

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

  const columns = useMemo<DataTableColumn<Hub>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (hub) => <span className="font-medium">{hub.name}</span>,
        value: (hub) => hub.name,
      },
      {
        id: "branch",
        header: "Branch",
        cell: (hub) => (
          <span className="text-muted-foreground text-sm">
            {hub.branchName} <span className="font-mono">({hub.branchCode})</span>
          </span>
        ),
        value: (hub) => hub.branchName,
      },
      {
        id: "code",
        header: "Code",
        cell: (hub) => <span className="font-mono text-xs">{hub.code}</span>,
        value: (hub) => hub.code,
      },
      {
        id: "type",
        header: "Type",
        cell: (hub) => <Badge variant="secondary">{hub.type}</Badge>,
        value: (hub) => hub.type,
      },
      {
        id: "status",
        header: "Status",
        cell: (hub) =>
          hub.status === "ACTIVE" ? (
            <Badge variant="success">Active</Badge>
          ) : hub.status === "MAINTENANCE" ? (
            <Badge variant="warning">Maintenance</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
        value: (hub) => hub.status,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (hub) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(hub.createdAt)}</span>
        ),
        value: (hub) => hub.createdAt,
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Organization"
        title="Hubs"
        description="Sorting and delivery points. Each belongs to one branch, and staff can be scoped to their assigned hubs."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              New hub
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load hubs"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search hubs"
                placeholder="Name, code or district"
              />
            </div>
            <ListFilterSelect
              className="w-36"
              label="Filter by type"
              allLabel="All types"
              value={search.type ?? ""}
              onChange={(value) => patch({ type: value || undefined })}
              options={HUB_TYPES.map((type) => ({ value: type, label: type }))}
            />
            <ListFilterSelect
              className="w-36"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={HUB_STATUSES.map((status) => ({
                value: status,
                label:
                  status === "ACTIVE"
                    ? "Active"
                    : status === "MAINTENANCE"
                      ? "Maintenance"
                      : "Inactive",
              }))}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(hub) => hub.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof HUB_SORT_COLUMNS)[number]}
            sort={search.sort}
            sortableColumns={HUB_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Warehouse}
                title="No hubs match these filters"
                description={
                  search.search || search.type || search.status
                    ? "Try a different search, or clear the filters."
                    : "No hubs yet. Create the first one."
                }
                action={
                  canCreate ? (
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus />
                      New hub
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) => patch({ sortBy: sortBy as HubsSearch["sortBy"], sort })}
          />
        </CardContent>
      </Card>

      <HubFormSheet open={createOpen} onOpenChange={setCreateOpen} onSubmit={createHub} />
    </div>
  )
}
