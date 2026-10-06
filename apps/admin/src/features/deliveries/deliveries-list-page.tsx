import { useQuery } from "@tanstack/react-query"
import { Bike, Plus, UserRoundCheck } from "lucide-react"
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
import { DELIVERY_STATUSES } from "@dropx/types"

import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listDeliveries } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { DeliveryRow } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { DeliveriesSearch } from "@/routes/deliveries-search-params"

import { DeliveryAssignSheet } from "./delivery-assign-sheet"
import { DELIVERY_STATUS_BADGE, DELIVERY_STATUS_LABEL } from "./delivery-status"
import { DeliveryStatusSheet } from "./delivery-status-sheet"

const DELIVERY_SORT_COLUMNS = ["assignedAt", "deliveredAt", "status", "createdAt"] as const

/**
 * The last-mile worklist.
 *
 * Three permissions meet on this screen and they are deliberately *three*,
 * not one: viewing the worklist (`deliveries.view`), opening attempts and
 * reassigning riders (`deliveries.assign`), and overriding a status
 * (`deliveries.manage`). Each control is gated by the key that authorises it
 * rather than the page being gated by `deliveries.view` alone.
 */
export function DeliveriesListPage({ search }: { search: DeliveriesSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("deliveries.manage")
  const canAssign = hasPermission("deliveries.assign")

  const createSheet = useFormSheetState()
  const assignSheet = useFormSheetState<string>()
  const statusSheet = useFormSheetState<string>()
  const [active, setActive] = useState<DeliveryRow | null>(null)

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy as DeliveriesSearch["sortBy"],
      sort: where.sort,
      search: where.search,
      status: where.status as DeliveriesSearch["status"],
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
    queryKey: ["deliveries", params],
    queryFn: () => listDeliveries(params),
  })

  const [, patch] = useQueryParams<DeliveriesSearch>("/deliveries", search)

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

  const openAssign = (delivery: DeliveryRow) => {
    setActive(delivery)
    assignSheet.openFor(delivery.id)
  }

  const openStatus = (delivery: DeliveryRow) => {
    setActive(delivery)
    statusSheet.openFor(delivery.id)
  }

  const columns = useMemo<DataTableColumn<DeliveryRow>[]>(
    () => [
      {
        id: "parcelTrackingNumber",
        header: "Parcel",
        cell: (delivery) => (
          <span className="font-mono text-xs">{delivery.parcelTrackingNumber}</span>
        ),
        value: (delivery) => delivery.parcelTrackingNumber,
      },
      {
        id: "deliveryAddress",
        header: "Deliver to",
        cell: (delivery) => (
          <span className="line-clamp-2 max-w-64 text-sm" title={delivery.deliveryAddress}>
            {delivery.deliveryAddress}
          </span>
        ),
        value: (delivery) => delivery.deliveryAddress,
      },
      {
        id: "hubName",
        header: "Hub",
        cell: (delivery) => <span className="text-sm">{delivery.hubName}</span>,
        value: (delivery) => delivery.hubName,
      },
      {
        id: "riderName",
        header: "Rider",
        cell: (delivery) => (
          <span className="text-sm">
            {delivery.riderName}{" "}
            <span className="text-muted-foreground font-mono text-xs">
              {delivery.riderEmployeeCode}
            </span>
          </span>
        ),
        value: (delivery) => delivery.riderName,
      },
      {
        id: "attemptNo",
        header: "Attempt",
        cell: (delivery) => <span className="font-mono text-xs">#{delivery.attemptNo}</span>,
        value: (delivery) => String(delivery.attemptNo),
      },
      {
        id: "status",
        header: "Status",
        cell: (delivery) => (
          <Badge variant={DELIVERY_STATUS_BADGE[delivery.status]}>
            {DELIVERY_STATUS_LABEL[delivery.status]}
          </Badge>
        ),
        value: (delivery) => delivery.status,
      },
      {
        id: "assignedAt",
        header: "Assigned",
        cell: (delivery) => (
          <span className="text-muted-foreground text-sm">
            {delivery.assignedAt ? formatDateTime(delivery.assignedAt) : "—"}
          </span>
        ),
        value: (delivery) => delivery.assignedAt ?? "",
      },
      {
        id: "actions",
        header: "",
        align: "end",
        cell: (delivery) => (
          <div className="flex justify-end gap-1">
            {canAssign && delivery.status === "ASSIGNED" ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Reassign rider for delivery ${delivery.id}`}
                onClick={() => openAssign(delivery)}
              >
                <UserRoundCheck />
                Reassign
              </Button>
            ) : null}
            {canManage &&
            delivery.status !== "DELIVERED" &&
            delivery.status !== "CANCELLED" &&
            delivery.status !== "RETURNED" &&
            delivery.status !== "FAILED" ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Update status of delivery ${delivery.id}`}
                onClick={() => openStatus(delivery)}
              >
                Status
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canAssign, canManage, assignSheet.openFor, statusSheet.openFor],
  )

  const filtered = Boolean(search.search || search.status || search.riderId || search.hubId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Deliveries"
        description="Last-mile attempts, from dispatch to signed-for."
        actions={
          canAssign ? (
            <Button onClick={() => createSheet.openNew()}>
              <Plus />
              New delivery
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load deliveries"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search deliveries"
                placeholder="Tracking number, hub, or rider"
              />
            </div>
            <ListFilterSelect
              className="w-48"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={DELIVERY_STATUSES.map((status) => ({
                value: status,
                label: DELIVERY_STATUS_LABEL[status],
              }))}
            />
          </div>
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
            rowId={(delivery) => delivery.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy}
            sort={search.sort}
            sortableColumns={DELIVERY_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Bike}
                title="No deliveries match these filters"
                description={
                  filtered
                    ? "Try a different search, or clear the filters."
                    : "Nothing to dispatch yet. Open the first attempt when a parcel is ready."
                }
                action={
                  canAssign ? (
                    <Button onClick={() => createSheet.openNew()}>
                      <Plus />
                      New delivery
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as DeliveriesSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <DeliveryAssignSheet
        key={`create-${createSheet.key}`}
        open={createSheet.open}
        onOpenChange={createSheet.onOpenChange}
        delivery={null}
      />

      <DeliveryAssignSheet
        key={`reassign-${assignSheet.key}`}
        open={assignSheet.open}
        onOpenChange={assignSheet.onOpenChange}
        delivery={active}
      />

      <DeliveryStatusSheet
        key={statusSheet.key}
        open={statusSheet.open}
        onOpenChange={statusSheet.onOpenChange}
        delivery={active}
      />
    </div>
  )
}
