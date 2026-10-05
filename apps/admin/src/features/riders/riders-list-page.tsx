import { useQuery } from "@tanstack/react-query"
import { Bike, Pencil, Plus } from "lucide-react"
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
import { COMPENSATION_TYPES, RIDER_STATUSES } from "@dropx/types"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listRiders, setRiderStatus } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { Rider, RiderStatus } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { RidersSearch } from "@/routes/riders-search-params"
import { RiderFormSheet } from "./rider-form-sheet"

const RIDER_SORT_COLUMNS = ["employeeCode", "status", "hubId", "createdAt"] as const

const STATUS_LABEL: Record<RiderStatus, string> = {
  AVAILABLE: "Available",
  BUSY: "Busy",
  OFFLINE: "Offline",
  SUSPENDED: "Suspended",
}

const STATUS_BADGE: Record<RiderStatus, "success" | "warning" | "secondary" | "destructive"> = {
  AVAILABLE: "success",
  BUSY: "warning",
  OFFLINE: "secondary",
  SUSPENDED: "destructive",
}

export function RidersListPage({ search }: { search: RidersSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("riders.manage")

  const sheet = useFormSheetState<string>()
  const [editing, setEditing] = useState<Rider | null>(null)

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      status: where.status as RidersSearch["status"],
      compensationType: where.compensationType as RidersSearch["compensationType"],
      hubId: where.hubId,
    }),
    [
      where.page,
      where.limit,
      where.sortBy,
      where.sort,
      where.search,
      where.status,
      where.compensationType,
      where.hubId,
    ],
  )

  const query = useQuery({
    queryKey: ["riders", params],
    queryFn: () => listRiders(params),
  })

  const [, patch] = useQueryParams<RidersSearch>("/riders", search)

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

  const columns = useMemo<DataTableColumn<Rider>[]>(
    () => [
      {
        id: "employeeCode",
        header: "Employee code",
        cell: (rider) => (
          <span className="font-mono text-xs font-medium">{rider.employeeCode}</span>
        ),
        value: (rider) => rider.employeeCode,
      },
      {
        id: "hubId",
        header: "Home hub",
        cell: (rider) => <span className="text-sm">{rider.hubId}</span>,
        value: (rider) => rider.hubId,
      },
      {
        id: "status",
        header: "Status",
        cell: (rider) => (
          <Badge variant={STATUS_BADGE[rider.status]}>{STATUS_LABEL[rider.status]}</Badge>
        ),
        value: (rider) => rider.status,
      },
      {
        id: "compensationType",
        header: "Pay",
        cell: (rider) => <span className="text-sm">{rider.compensationType}</span>,
        value: (rider) => rider.compensationType,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (rider) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(rider.createdAt)}</span>
        ),
        value: (rider) => rider.createdAt,
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              align: "end" as const,
              cell: (rider: Rider) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Mark ${rider.employeeCode} available`}
                    disabled={rider.status === "AVAILABLE"}
                    onClick={() => {
                      setEditing(null)
                      setRiderStatus(rider.id, "AVAILABLE")
                    }}
                  >
                    Available
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${rider.employeeCode}`}
                    onClick={() => {
                      setEditing(rider)
                      sheet.openFor(rider.id)
                    }}
                  >
                    <Pencil />
                    Edit
                  </Button>
                </div>
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
        eyebrow="Fleet"
        title="Riders"
        description="Delivery riders, their home hub and their current availability."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                sheet.openNew()
              }}
            >
              <Plus />
              New rider
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load riders"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search riders"
                placeholder="Name, email or code"
              />
            </div>
            <ListFilterSelect
              className="w-40"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={RIDER_STATUSES.map((status) => ({
                value: status,
                label: STATUS_LABEL[status],
              }))}
            />
            <ListFilterSelect
              className="w-44"
              label="Filter by pay type"
              allLabel="All pay types"
              value={search.compensationType ?? ""}
              onChange={(value) => patch({ compensationType: value || undefined })}
              options={COMPENSATION_TYPES.map((value) => ({ value, label: value }))}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(rider) => rider.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof RIDER_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={RIDER_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Bike}
                title="No riders match these filters"
                description={
                  search.search || search.status || search.compensationType
                    ? "Try a different search, or clear the filters."
                    : "No riders yet. Add the first one."
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
                      New rider
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as RidersSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <RiderFormSheet
        key={sheet.key}
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        rider={editing}
      />
    </div>
  )
}
