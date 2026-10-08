import { useQuery } from "@tanstack/react-query"
import { ArrowDownToLine, ArrowUpFromLine, MapPin, Plus, Truck } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ServerDataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useFormSheetState,
  type DataTableColumn,
} from "@dropx/ui"
import { TRANSFER_STATUSES } from "@dropx/types"

import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { getTransfer, listHubsForPicker, listTransfers } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { TransferListItem, TransferWithManifest } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { TransfersSearch } from "@/routes/transfers-search-params"

import { TransferFormSheet } from "./transfer-form-sheet"
import { TransferManifestSheet } from "./transfer-manifest-sheet"
import { TRANSFER_STATUS_BADGE, TRANSFER_STATUS_LABEL } from "./transfer-status"
import { TransferStatusSheet } from "./transfer-status-sheet"

const TRANSFER_SORT_COLUMNS = ["departedAt", "arrivedAt", "status", "createdAt"] as const

function nextAction(transfer: TransferListItem, currentHubId: string): string {
  switch (transfer.status) {
    case "PLANNED":
      return "Add parcels to manifest"
    case "LOADING":
      return "Depart transfer"
    case "IN_TRANSIT":
      return transfer.toHubId === currentHubId ? "Receive at this hub" : "Await arrival"
    case "ARRIVED":
      return "Ready for delivery"
    case "CANCELLED":
      return "Cancelled"
  }
}

/**
 * The hub-to-hub worklist.
 *
 * Two permissions meet on this screen, deliberately: viewing the worklist and
 * planning a transfer are different jobs, and a hub that only needs to see what
 * is moving should not be able to create or edit. Each control is gated by the
 * key that authorises it rather than the page being gated by `transfers.view`
 * alone.
 *
 * The row shows both hub names rather than ids, because a dispatcher reads
 * "Kamalpur → Faridpur", not two UUIDs. The API joins both names into the list
 * projection for exactly this reason.
 */
export function TransfersListPage({ search }: { search: TransfersSearch }) {
  const { hasPermission, user } = useAuth()
  const canManage = hasPermission("transfers.manage")

  const createSheet = useFormSheetState()
  const editSheet = useFormSheetState<string>()
  const statusSheet = useFormSheetState<string>()
  const manifestSheet = useFormSheetState<string>()
  const [active, setActive] = useState<TransferWithManifest | null>(null)

  const hubsQuery = useQuery({
    queryKey: ["transfer-context-hubs", user?.hubIds],
    queryFn: () => listHubsForPicker({ page: 1, limit: 100 }),
    enabled: Boolean(user),
    staleTime: 60_000,
  })
  const hubs = useMemo(() => {
    const all = hubsQuery.data?.nodes ?? []
    if (!user?.hubIds.length || user.roles.includes("ADMIN")) return all
    return all.filter((hub) => user.hubIds.includes(hub.id))
  }, [hubsQuery.data?.nodes, user?.hubIds, user?.roles])
  const currentHub = hubs.find((hub) => hub.id === search.hubId) ?? null

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy as TransfersSearch["sortBy"],
      sort: where.sort,
      search: where.search,
      status: where.status as TransfersSearch["status"],
      hubId: search.hubId,
      vehicleId: search.vehicleId,
      driverId: search.driverId,
      direction: search.direction,
    }),
    [
      where.page,
      where.limit,
      where.sortBy,
      where.sort,
      where.search,
      where.status,
      search.hubId,
      search.vehicleId,
      search.driverId,
      search.direction,
    ],
  )

  const query = useQuery({
    queryKey: ["transfers", params],
    queryFn: () => listTransfers(params),
  })

  const [, patch] = useQueryParams<TransfersSearch>("/transfers", search)

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

  const openEdit = async (transfer: TransferListItem) => {
    const full = await getTransfer(transfer.id)
    setActive(full)
    editSheet.openFor(transfer.id)
  }

  const openStatus = async (transfer: TransferListItem) => {
    const full = await getTransfer(transfer.id)
    setActive(full)
    statusSheet.openFor(transfer.id)
  }

  const openManifest = async (transfer: TransferListItem) => {
    const full = await getTransfer(transfer.id)
    setActive(full)
    manifestSheet.openFor(transfer.id)
  }

  const columns = useMemo<DataTableColumn<TransferListItem>[]>(
    () => [
      {
        id: "transferNumber",
        header: "Transfer",
        cell: (transfer) => <span className="font-mono text-xs">{transfer.transferNumber}</span>,
        value: (transfer) => transfer.transferNumber,
      },
      {
        id: "route",
        header: "Route",
        cell: (transfer) => (
          <span className="text-sm">
            {transfer.fromHubName} <span className="text-muted-foreground">→</span>{" "}
            {transfer.toHubName}
          </span>
        ),
        value: (transfer) => `${transfer.fromHubName} ${transfer.toHubName}`,
      },
      {
        id: "parcelCount",
        header: "Parcels",
        cell: (transfer) => (
          <span className="text-muted-foreground text-sm">{transfer.parcelCount}</span>
        ),
        value: (transfer) => String(transfer.parcelCount),
      },
      {
        id: "status",
        header: "Status",
        cell: (transfer) => (
          <Badge variant={TRANSFER_STATUS_BADGE[transfer.status]}>
            {TRANSFER_STATUS_LABEL[transfer.status]}
          </Badge>
        ),
        value: (transfer) => transfer.status,
      },
      {
        id: "nextAction",
        header: "Next action",
        cell: (transfer) => (
          <span className="text-sm font-medium">{nextAction(transfer, search.hubId)}</span>
        ),
        value: (transfer) => nextAction(transfer, search.hubId),
      },
      {
        id: "departedAt",
        header: "Departed",
        cell: (transfer) => (
          <span className="text-muted-foreground text-sm">
            {transfer.departedAt ? formatDateTime(transfer.departedAt) : "—"}
          </span>
        ),
        value: (transfer) => transfer.departedAt ?? "",
      },
      {
        id: "arrivedAt",
        header: "Arrived",
        cell: (transfer) => (
          <span className="text-muted-foreground text-sm">
            {transfer.arrivedAt ? formatDateTime(transfer.arrivedAt) : "—"}
          </span>
        ),
        value: (transfer) => transfer.arrivedAt ?? "",
      },
      {
        id: "createdAt",
        header: "Raised",
        cell: (transfer) => (
          <span className="text-muted-foreground text-sm">
            {formatDateTime(transfer.createdAt)}
          </span>
        ),
        value: (transfer) => transfer.createdAt,
      },
      {
        id: "actions",
        header: "",
        align: "end",
        cell: (transfer) => (
          <div className="flex justify-end gap-1">
            {canManage && transfer.status !== "IN_TRANSIT" && transfer.status !== "ARRIVED" ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Edit transfer ${transfer.transferNumber}`}
                onClick={() => void openEdit(transfer)}
              >
                Edit
              </Button>
            ) : null}
            {canManage && transfer.status !== "ARRIVED" && transfer.status !== "CANCELLED" ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Update status of transfer ${transfer.transferNumber}`}
                onClick={() => void openStatus(transfer)}
              >
                Status
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit manifest of transfer ${transfer.transferNumber}`}
              onClick={() => void openManifest(transfer)}
            >
              Manifest
            </Button>
          </div>
        ),
      },
    ],
    // `openEdit`/`openStatus`/`openManifest` are stable enough for a row render —
    // they only set state — but they are listed so a stale closure cannot outlive
    // a change to the sheet hooks.
    [canManage, editSheet.openFor, statusSheet.openFor, manifestSheet.openFor, search.hubId],
  )

  const filtered = Boolean(
    search.search || search.status || search.hubId || search.vehicleId || search.driverId,
  )

  useEffect(() => {
    const onlyHub = hubs[0]
    if (onlyHub && hubs.length === 1 && !search.hubId) patch({ hubId: onlyHub.id, page: 1 })
  }, [hubs, search.hubId])

  const contextLabel = currentHub
    ? `${currentHub.name} (${currentHub.code})`
    : "All accessible hubs"
  const updateManifest = (parcels: TransferWithManifest["parcels"]) => {
    setActive((current) => (current ? { ...current, parcels } : current))
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Transfers"
        description="Move parcels between hubs with a clear loading and receiving workflow."
        actions={
          canManage ? (
            <Button onClick={() => createSheet.openNew()}>
              <Plus />
              New transfer
            </Button>
          ) : null
        }
      />

      <Card className="border-primary/20 bg-primary/[0.03] gap-0 py-0">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex min-w-60 flex-1 items-start gap-3">
            <MapPin className="text-primary mt-0.5 size-5" />
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Working context
              </p>
              <p className="text-sm font-semibold">{contextLabel}</p>
              <p className="text-muted-foreground text-xs">
                {currentHub
                  ? "Transfers from this hub are outgoing; transfers to it are incoming."
                  : "Choose a hub to see your loading and receiving work."}
              </p>
            </div>
          </div>
          <Select
            value={search.hubId || "all"}
            onValueChange={(value) => patch({ hubId: value === "all" ? "" : value, page: 1 })}
          >
            <SelectTrigger className="w-64" aria-label="Current hub">
              <SelectValue placeholder="Choose current hub" />
            </SelectTrigger>
            <SelectContent>
              {user?.hubIds.length !== 1 || user.roles.includes("ADMIN") ? (
                <SelectItem value="all">All accessible hubs</SelectItem>
              ) : null}
              {hubs.map((hub) => (
                <SelectItem key={hub.id} value={hub.id}>
                  {hub.name} · {hub.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { value: "all" as const, label: "All transfers", icon: Truck },
          { value: "outgoing" as const, label: "Outgoing · load here", icon: ArrowUpFromLine },
          { value: "incoming" as const, label: "Incoming · receive here", icon: ArrowDownToLine },
        ].map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant={search.direction === value ? "default" : "outline"}
            className="justify-start"
            disabled={!currentHub && value !== "all"}
            onClick={() => patch({ direction: value, page: 1 })}
          >
            <Icon />
            {label}
          </Button>
        ))}
      </div>

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load transfers"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search transfers"
                placeholder="Transfer number, hub, or vehicle"
              />
            </div>
            <ListFilterSelect
              className="w-48"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={TRANSFER_STATUSES.map((status) => ({
                value: status,
                label: TRANSFER_STATUS_LABEL[status],
              }))}
            />
          </div>
          {/* `vehicleId` and `driverId` arrive in the URL from other screens
              rather than from controls here, so they are shown as removable chips
              instead of filters that cannot be set on this page. */}
          {search.vehicleId || search.driverId ? (
            <div className="text-muted-foreground flex flex-wrap gap-2 pt-2 text-xs">
              {search.vehicleId ? (
                <button
                  type="button"
                  className="hover:bg-muted rounded-full border px-2 py-0.5"
                  onClick={() => patch({ vehicleId: "" })}
                >
                  Vehicle {search.vehicleId} ✕
                </button>
              ) : null}
              {search.driverId ? (
                <button
                  type="button"
                  className="hover:bg-muted rounded-full border px-2 py-0.5"
                  onClick={() => patch({ driverId: "" })}
                >
                  Driver {search.driverId} ✕
                </button>
              ) : null}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(transfer) => transfer.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy}
            sort={search.sort}
            sortableColumns={TRANSFER_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Truck}
                title="No transfers match these filters"
                description={
                  filtered
                    ? "Try a different search, or clear the filters."
                    : "Nothing moving between hubs yet. Plan the first transfer when a route is ready."
                }
                action={
                  canManage ? (
                    <Button onClick={() => createSheet.openNew()}>
                      <Plus />
                      New transfer
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as TransfersSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <TransferFormSheet
        key={createSheet.key}
        open={createSheet.open}
        onOpenChange={createSheet.onOpenChange}
        defaultFromHubId={currentHub?.id}
      />

      <TransferFormSheet
        key={editSheet.key}
        open={editSheet.open}
        onOpenChange={editSheet.onOpenChange}
        transfer={active}
      />

      <TransferStatusSheet
        key={statusSheet.key}
        open={statusSheet.open}
        onOpenChange={statusSheet.onOpenChange}
        transfer={active}
      />

      <TransferManifestSheet
        key={manifestSheet.key}
        open={manifestSheet.open}
        onOpenChange={manifestSheet.onOpenChange}
        transfer={active}
        onManifestChange={updateManifest}
      />
    </div>
  )
}
