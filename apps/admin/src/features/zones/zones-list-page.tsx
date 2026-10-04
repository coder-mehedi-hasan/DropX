import { useQuery } from "@tanstack/react-query"
import { Globe, Pencil, Plus } from "lucide-react"
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
import { ZONE_STATUSES } from "@dropx/db"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listZones } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import { type Zone } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { ZonesSearch } from "@/routes/zones-search-params"
import { ZoneFormSheet } from "./zone-form-sheet"

const ZONE_SORT_COLUMNS = ["name", "code", "status", "createdAt"] as const

export function ZonesListPage({ search }: { search: ZonesSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("zones.manage")

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Zone | null>(null)

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      status: where.status as ZonesSearch["status"],
    }),
    [where.page, where.limit, where.sortBy, where.sort, where.search, where.status],
  )

  const query = useQuery({
    queryKey: ["zones", params],
    queryFn: () => listZones(params),
  })

  const [, patch] = useQueryParams<ZonesSearch>("/zones", search)

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

  const columns = useMemo<DataTableColumn<Zone>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (zone) => <span className="font-medium">{zone.name}</span>,
        value: (zone) => zone.name,
      },
      {
        id: "code",
        header: "Code",
        cell: (zone) => <span className="font-mono text-xs">{zone.code}</span>,
        value: (zone) => zone.code,
      },
      {
        id: "description",
        header: "Description",
        cell: (zone) => zone.description ?? "—",
        value: (zone) => zone.description ?? "",
        hideBelow: "lg",
      },
      {
        id: "status",
        header: "Status",
        cell: (zone) =>
          zone.status === "ACTIVE" ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
        value: (zone) => zone.status,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (zone) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(zone.createdAt)}</span>
        ),
        value: (zone) => zone.createdAt,
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              align: "end" as const,
              cell: (zone: Zone) => (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${zone.name}`}
                  onClick={() => {
                    setEditing(zone)
                    setSheetOpen(true)
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
    [canManage],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Network"
        title="Zones"
        description="Geographic pricing areas used to calculate delivery fees."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                setSheetOpen(true)
              }}
            >
              <Plus />
              New zone
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load zones"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search zones"
                placeholder="Name, code or description"
              />
            </div>
            <ListFilterSelect
              className="w-40"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={ZONE_STATUSES.map((status) => ({
                value: status,
                label: status === "ACTIVE" ? "Active" : "Inactive",
              }))}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(zone) => zone.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof ZONE_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={ZONE_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Globe}
                title="No zones match these filters"
                description={
                  search.search || search.status
                    ? "Try a different search, or clear the filters."
                    : "No zones yet. Create the first one."
                }
                action={
                  canManage ? (
                    <Button
                      onClick={() => {
                        setEditing(null)
                        setSheetOpen(true)
                      }}
                    >
                      <Plus />
                      New zone
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as ZonesSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <ZoneFormSheet open={sheetOpen} onOpenChange={setSheetOpen} zone={editing} />
    </div>
  )
}
