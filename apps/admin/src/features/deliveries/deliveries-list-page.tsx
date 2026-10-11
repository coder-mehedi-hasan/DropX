import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Bike,
  MoreHorizontal,
  PackageCheck,
  Plus,
  RotateCcw,
  UserRoundCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import {
  AppToast,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  LoadingButton,
  ServerDataTable,
  useConfirmation,
  useFormSheetState,
  type DataTableColumn,
} from "@dropx/ui"
import { DELIVERY_STATUSES, DELIVERY_TRANSITIONS, type DeliveryStatus } from "@dropx/types"

import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listDeliveries, updateDeliveryStatus } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { DeliveryRow } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { DeliveriesSearch } from "@/routes/deliveries-search-params"

import { DeliveryAssignSheet } from "./delivery-assign-sheet"
import { DELIVERY_STATUS_BADGE, DELIVERY_STATUS_LABEL } from "./delivery-status"

const DELIVERY_SORT_COLUMNS = ["assignedAt", "deliveredAt", "status", "createdAt"] as const

/**
 * The one forward move worth surfacing as a button per row — the milestone the
 * dispatcher is actually trying to reach. Built from the same shape as
 * `DELIVERY_TRANSITIONS`: what turns into a button here is exactly what the API
 * will accept from the current status.
 */
const FORWARD_ACTION: Partial<
  Record<DeliveryStatus, { to: DeliveryStatus; label: string; icon: LucideIcon }>
> = {
  ASSIGNED: { to: "OUT_FOR_DELIVERY", label: "Start delivery", icon: Bike },
  OUT_FOR_DELIVERY: { to: "DELIVERED", label: "Mark delivered", icon: PackageCheck },
}

/**
 * What to say when confirming a given move. `FAILED` and `CANCELLED` lock the
 * reason box — the API refuses those without one — while every other move keeps
 * it optional, matching `deliveries.service.ts`.
 */
const STATUS_MOVE: Record<
  DeliveryStatus,
  { confirmLabel: string; description: string; placeholder?: string; requiresReason: boolean }
> = {
  ASSIGNED: {
    confirmLabel: "Reassign",
    description: "Only reached through reassignment, never the status dialog.",
    requiresReason: false,
  },
  OUT_FOR_DELIVERY: {
    confirmLabel: "Start delivery",
    description:
      "Marks the attempt as out for delivery — the rider has left the hub with the parcel.",
    placeholder: "Route notes (optional)",
    requiresReason: false,
  },
  DELIVERED: {
    confirmLabel: "Mark delivered",
    description: "Closes the attempt as delivered. Confirm the proof of handover is filed first.",
    placeholder: "Delivery notes (optional)",
    requiresReason: false,
  },
  FAILED: {
    confirmLabel: "Mark failed",
    description: "Records a failed attempt. The parcel returns to At hub and can be re-dispatched.",
    placeholder: "Customer not home, address unreachable…",
    requiresReason: true,
  },
  CANCELLED: {
    confirmLabel: "Cancel delivery",
    description: "Sends the parcel back to At hub at this hub so it can be dispatched again.",
    placeholder: "Why is it not going?",
    requiresReason: true,
  },
  RETURNED: {
    confirmLabel: "Mark returned",
    description: "Records that the parcel came back unsent.",
    placeholder: "Return note (optional)",
    requiresReason: false,
  },
}

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
  const [active, setActive] = useState<DeliveryRow | null>(null)
  const { confirmWithReason, confirmationDialog } = useConfirmation()
  const queryClient = useQueryClient()
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null)
  const updateStatus = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: DeliveryStatus; reason: string }) =>
      updateDeliveryStatus(id, {
        status,
        reason: reason.trim() ? reason.trim() : undefined,
      }),
    onMutate: ({ id }) => setStatusPendingId(id),
    onSettled: () => setStatusPendingId(null),
    onSuccess: () => {
      AppToast.success("Delivery updated")
      void queryClient.invalidateQueries({ queryKey: ["deliveries"] })
    },
  })

  async function askStatusMove(delivery: DeliveryRow, to: DeliveryStatus) {
    const move = STATUS_MOVE[to]
    const result = await confirmWithReason({
      title: `${move.confirmLabel} · ${delivery.parcelTrackingNumber}?`,
      description: move.description,
      confirmLabel: move.confirmLabel,
      destructive: to === "CANCELLED",
      reason: { placeholder: move.placeholder, required: move.requiresReason },
    })
    if (result.confirmed) {
      updateStatus.mutate({ id: delivery.id, status: to, reason: result.reason })
    }
  }

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
        cell: (delivery) => {
          const forward = FORWARD_ACTION[delivery.status]
          const busy = statusPendingId === delivery.id
          const statusBusy = statusPendingId !== null
          const extraMoves = canManage
            ? DELIVERY_TRANSITIONS[delivery.status].filter((to) => to !== forward?.to)
            : []
          const showReassign = canAssign && delivery.status === "ASSIGNED"
          const hasKebab = showReassign || extraMoves.length > 0

          return (
            <div className="flex items-center justify-end gap-1">
              {canManage && forward ? (
                <LoadingButton
                  variant="outline"
                  size="sm"
                  loading={busy}
                  disabled={statusBusy}
                  aria-label={`${forward.label} ${delivery.parcelTrackingNumber}`}
                  onClick={() => void askStatusMove(delivery, forward.to)}
                >
                  <forward.icon />
                  {forward.label}
                </LoadingButton>
              ) : null}
              {hasKebab ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Actions for delivery ${delivery.id}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel className="font-mono text-xs">
                      {delivery.parcelTrackingNumber}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {showReassign ? (
                      <DropdownMenuItem onSelect={() => openAssign(delivery)}>
                        <UserRoundCheck />
                        Reassign rider
                      </DropdownMenuItem>
                    ) : null}
                    {extraMoves.map((to) => (
                      <DropdownMenuItem
                        key={to}
                        className={to === "CANCELLED" ? "text-destructive" : undefined}
                        disabled={statusBusy}
                        onSelect={() => void askStatusMove(delivery, to)}
                      >
                        {to === "CANCELLED" ? <XCircle /> : <RotateCcw />}
                        {STATUS_MOVE[to].confirmLabel}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          )
        },
      },
    ],
    // `askStatusMove` only sets state or fires a mutation — it is stable enough
    // for a row render — but it is listed so a stale closure cannot outlive a
    // change here.
    [canAssign, canManage, assignSheet.openFor, confirmWithReason, updateStatus, statusPendingId],
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

      {confirmationDialog}
    </div>
  )
}
