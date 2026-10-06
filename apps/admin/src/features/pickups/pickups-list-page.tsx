import { useQuery } from "@tanstack/react-query"
import { PackageCheck, Plus, UserRoundCheck } from "lucide-react"
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
import { PICKUP_STATUSES } from "@dropx/types"

import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listPickups } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { Pickup } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { PickupsSearch } from "@/routes/pickups-search-params"

import { PickupAssignSheet } from "./pickup-assign-sheet"
import { PickupFormSheet } from "./pickup-form-sheet"
import { PICKUP_STATUS_BADGE, PICKUP_STATUS_LABEL } from "./pickup-status"
import { PickupStatusSheet } from "./pickup-status-sheet"

const PICKUP_SORT_COLUMNS = ["scheduledAt", "status", "createdAt"] as const

/**
 * The collections worklist.
 *
 * Three permissions meet on this screen and they are deliberately *three*, not
 * one: viewing the worklist, raising a collection, and dispatching a rider are
 * different jobs, and a hub that only needs to see what is outstanding should not
 * be able to create or assign. Each control is gated by the key that authorises
 * it rather than the page being gated by `pickups.view` alone.
 *
 * The row shows the raw rider id rather than a name, because `pickups` carries
 * `assigned_rider_id` and nothing else — the name lives on the `riders` row, and
 * joining it in would mean the list endpoint silently returning a different shape
 * than its contract says. Dispatch reads the id fine; it is the same value the
 * assign sheet hands back.
 */
export function PickupsListPage({ search }: { search: PickupsSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("pickups.manage")
  const canAssign = hasPermission("pickups.assign")

  const createSheet = useFormSheetState()
  const assignSheet = useFormSheetState<string>()
  const statusSheet = useFormSheetState<string>()
  const [active, setActive] = useState<Pickup | null>(null)

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy as PickupsSearch["sortBy"],
      sort: where.sort,
      search: where.search,
      status: where.status as PickupsSearch["status"],
      riderId: search.riderId,
      hubId: search.hubId,
    }),
    [
      where.page,
      where.limit,
      where.sortBy,
      where.sort,
      where.search,
      where.status,
      search.riderId,
      search.hubId,
    ],
  )

  const query = useQuery({
    queryKey: ["pickups", params],
    queryFn: () => listPickups(params),
  })

  const [, patch] = useQueryParams<PickupsSearch>("/pickups", search)

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

  const openAssign = (pickup: Pickup) => {
    setActive(pickup)
    assignSheet.openFor(pickup.id)
  }

  const openStatus = (pickup: Pickup) => {
    setActive(pickup)
    statusSheet.openFor(pickup.id)
  }

  const columns = useMemo<DataTableColumn<Pickup>[]>(
    () => [
      {
        id: "parcelId",
        header: "Parcel",
        cell: (pickup) => <span className="font-mono text-xs">{pickup.parcelId}</span>,
        value: (pickup) => pickup.parcelId,
      },
      {
        id: "pickupAddress",
        header: "Collect from",
        cell: (pickup) => (
          <span className="line-clamp-2 max-w-64 text-sm" title={pickup.pickupAddress}>
            {pickup.pickupAddress}
          </span>
        ),
        value: (pickup) => pickup.pickupAddress,
      },
      {
        id: "assignedRiderId",
        header: "Rider",
        cell: (pickup) =>
          pickup.assignedRiderId ? (
            <span className="font-mono text-xs">{pickup.assignedRiderId}</span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          ),
        value: (pickup) => pickup.assignedRiderId ?? "",
      },
      {
        id: "status",
        header: "Status",
        cell: (pickup) => (
          <Badge variant={PICKUP_STATUS_BADGE[pickup.status]}>
            {PICKUP_STATUS_LABEL[pickup.status]}
          </Badge>
        ),
        value: (pickup) => pickup.status,
      },
      {
        id: "scheduledAt",
        header: "Scheduled",
        cell: (pickup) => (
          <span className="text-muted-foreground text-sm">
            {pickup.scheduledAt ? formatDateTime(pickup.scheduledAt) : "—"}
          </span>
        ),
        value: (pickup) => pickup.scheduledAt ?? "",
      },
      {
        id: "createdAt",
        header: "Raised",
        cell: (pickup) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(pickup.createdAt)}</span>
        ),
        value: (pickup) => pickup.createdAt,
      },
      {
        id: "actions",
        header: "",
        align: "end",
        cell: (pickup) => (
          <div className="flex justify-end gap-1">
            {canAssign && pickup.status === "REQUESTED" ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Assign a rider to pickup ${pickup.id}`}
                onClick={() => openAssign(pickup)}
              >
                <UserRoundCheck />
                Assign
              </Button>
            ) : null}
            {canManage && pickup.status !== "PICKED_UP" && pickup.status !== "CANCELLED" ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Update status of pickup ${pickup.id}`}
                onClick={() => openStatus(pickup)}
              >
                Status
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    // `openAssign`/`openStatus` are stable enough for a row render — they only
    // set state — but they are listed so a stale closure cannot outlive a change
    // to the sheet hooks.
    [canAssign, canManage, assignSheet.openFor, statusSheet.openFor],
  )

  const filtered = Boolean(search.search || search.status || search.riderId || search.hubId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Pickups"
        description="Collections against parcels — raised, dispatched to a rider, and closed off."
        actions={
          canManage ? (
            <Button onClick={() => createSheet.openNew()}>
              <Plus />
              New pickup
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load pickups"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search pickups"
                placeholder="Address or tracking number"
              />
            </div>
            <ListFilterSelect
              className="w-48"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={PICKUP_STATUSES.map((status) => ({
                value: status,
                label: PICKUP_STATUS_LABEL[status],
              }))}
            />
          </div>
          {/* `riderId` and `hubId` arrive in the URL from other screens rather than
              from controls here, so they are shown as removable chips instead of
              filters that cannot be set on this page. */}
          {search.riderId || search.hubId ? (
            <div className="text-muted-foreground flex flex-wrap gap-2 pt-2 text-xs">
              {search.riderId ? (
                <button
                  type="button"
                  className="hover:bg-muted rounded-full border px-2 py-0.5"
                  onClick={() => patch({ riderId: "" })}
                >
                  Rider {search.riderId} ✕
                </button>
              ) : null}
              {search.hubId ? (
                <button
                  type="button"
                  className="hover:bg-muted rounded-full border px-2 py-0.5"
                  onClick={() => patch({ hubId: "" })}
                >
                  Hub {search.hubId} ✕
                </button>
              ) : null}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(pickup) => pickup.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy}
            sort={search.sort}
            sortableColumns={PICKUP_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={PackageCheck}
                title="No pickups match these filters"
                description={
                  filtered
                    ? "Try a different search, or clear the filters."
                    : "Nothing to collect yet. Raise the first pickup when a customer is ready."
                }
                action={
                  canManage ? (
                    <Button onClick={() => createSheet.openNew()}>
                      <Plus />
                      New pickup
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as PickupsSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <PickupFormSheet
        key={createSheet.key}
        open={createSheet.open}
        onOpenChange={createSheet.onOpenChange}
      />

      <PickupAssignSheet
        key={assignSheet.key}
        open={assignSheet.open}
        onOpenChange={assignSheet.onOpenChange}
        pickup={active}
      />

      <PickupStatusSheet
        key={statusSheet.key}
        open={statusSheet.open}
        onOpenChange={statusSheet.onOpenChange}
        pickup={active}
      />
    </div>
  )
}
