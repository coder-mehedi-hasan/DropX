import { useQuery } from "@tanstack/react-query"
import { PARCEL_STATUSES, PAYMENT_TYPES } from "@dropx/types"
import { Copy, MoreHorizontal, Package, Plus, Truck } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
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
  StatusBadge,
  ServerDataTable,
  parcelStatusLabel,
  type DataTableColumn,
  AppToast,
} from "@dropx/ui"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ReferenceCombobox } from "@/components/reference-combobox"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listParcels } from "@/lib/endpoints"
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format"
import { PARCEL_SORT_COLUMNS, paymentFilter, statusFilter } from "@/lib/parcels"
import type { Parcel, ParcelListParams, ParcelSortColumn } from "@/lib/parcels"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { ParcelsSearch } from "@/routes/search-params"

import { ParcelCreateDialog } from "./parcel-create-dialog"

export function ParcelsListPage({ search }: { search: ParcelsSearch }) {
  const { hasPermission } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)

  /** The hub filter calls `hubs.view`, so it is only offered to roles that hold it. */
  const canFilterByHub = hasPermission("hubs.view")

  // The URL takes the keystroke; only the debounced value costs a request.
  // `usePaginatedListWhere` is what owns that split, and it is also what resets
  // nothing on its own -- page resets live in `patch`, so the rule is stated
  // once rather than at each call site.
  const where = usePaginatedListWhere(search)

  const params = useMemo<ParcelListParams>(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search || undefined,
      status: statusFilter(where.status),
      paymentType: paymentFilter(where.paymentType),
      hubId: where.hubId,
    }),
    [
      where.page,
      where.limit,
      where.sortBy,
      where.sort,
      where.search,
      where.status,
      where.paymentType,
      where.hubId,
    ],
  )

  const query = useQuery({
    queryKey: ["parcels", params],
    queryFn: ({ signal }) => listParcels(params, signal),
  })

  /**
   * Every list mutation resets to page 1 — page 4 of a new result set is empty.
   * `useQueryParams` owns that rule and the whole-object write; an omitted key
   * would otherwise keep its previous value and silently refuse to clear a filter.
   */
  const [, patch] = useQueryParams<ParcelsSearch>("/parcels", search)

  const meta = query.data?.meta
  const nodes = query.data?.nodes ?? []

  /**
   * `ServerDataTable` asks for a flat `ServerPageMeta`, and the API hands back
   * `PageMeta` — same fields, different names (`currentPage` vs `page`). The
   * rename lives here rather than in the wrapper, so the wrapper's contract is
   * one shape and a second caller cannot feed it the wrong one by accident.
   */
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

  const columns = useMemo<DataTableColumn<Parcel>[]>(
    () => [
      {
        id: "trackingNumber",
        header: "Tracking",
        cell: (parcel) => (
          <Link
            to="/parcels/$parcelId"
            params={{ parcelId: parcel.id }}
            className="text-accent-ink hover:text-accent-ink-hover font-mono text-xs font-semibold underline-offset-4 hover:underline"
          >
            {parcel.trackingNumber}
          </Link>
        ),
        value: (parcel) => parcel.trackingNumber,
      },
      {
        id: "status",
        header: "Status",
        cell: (parcel) => <StatusBadge status={parcel.status} />,
        value: (parcel) => parcel.status,
      },
      {
        id: "receiver",
        header: "Receiver",
        cell: (parcel) => (
          <span className="text-muted-foreground block max-w-52 truncate text-sm">
            <span className="text-foreground block font-medium">
              {parcel.receiverName ||
                (parcel.receiverCustomerId ? `Customer #${parcel.receiverCustomerId}` : "—")}
            </span>
          </span>
        ),
        value: (parcel) => parcel.receiverName ?? parcel.receiverCustomerId ?? "",
      },
      {
        id: "parcelType",
        header: "Type",
        cell: (parcel) => <Badge variant="secondary">{parcel.parcelType}</Badge>,
        value: (parcel) => parcel.parcelType,
      },
      {
        id: "paymentType",
        header: "Payment",
        cell: (parcel) =>
          parcel.paymentType === "COD" ? (
            <Badge variant="warning">COD</Badge>
          ) : (
            <Badge variant="outline">Prepaid</Badge>
          ),
        value: (parcel) => parcel.paymentType,
      },
      {
        id: "weight",
        header: "Weight",
        align: "end",
        numeric: true,
        cell: (parcel) => `${formatNumber(parcel.weight)} kg`,
        value: (parcel) => parcel.weight,
      },
      {
        id: "deliveryFee",
        header: "Fee",
        align: "end",
        numeric: true,
        cell: (parcel) => formatMoney(parcel.deliveryFee),
        value: (parcel) => parcel.deliveryFee,
      },
      {
        id: "codAmount",
        header: "COD",
        align: "end",
        numeric: true,
        cell: (parcel) => (parcel.codAmount > 0 ? formatMoney(parcel.codAmount) : "—"),
        value: (parcel) => parcel.codAmount,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (parcel) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(parcel.createdAt)}</span>
        ),
        value: (parcel) => parcel.createdAt,
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Parcels"
        description="Every parcel in the scope your roles allow — company-wide, your branch, or your hubs."
        actions={
          hasPermission("parcels.create") ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              New parcel
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load parcels"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search parcels"
                placeholder="Tracking number, receiver name or phone"
              />
            </div>

            <ListFilterSelect
              className="w-44"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={PARCEL_STATUSES.map((status) => ({
                value: status,
                label: parcelStatusLabel(status),
              }))}
            />

            <ListFilterSelect
              className="w-36"
              label="Filter by payment type"
              allLabel="All payments"
              value={search.paymentType ?? ""}
              onChange={(value) => patch({ paymentType: value || undefined })}
              options={PAYMENT_TYPES.map((type) => ({
                value: type,
                label: type === "COD" ? "Cash on delivery" : "Prepaid",
              }))}
            />

            {/*
              Gated on `hubs.view` rather than shown-then-failing: the endpoint
              answers 403 to a role without the key, and a filter that errors on
              every change is worse than a filter that is not offered.
            */}
            {canFilterByHub ? (
              <div className="w-52">
                <ReferenceCombobox
                  source="hubs"
                  placeholder="All hubs"
                  value={search.hubId ?? ""}
                  onChange={(hubId) => patch({ hubId: hubId || undefined })}
                />
              </div>
            ) : null}

            {search.status || search.paymentType || search.search || search.hubId ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  patch({
                    search: "",
                    status: undefined,
                    paymentType: undefined,
                    hubId: undefined,
                  })
                }
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(parcel) => parcel.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy}
            sort={search.sort}
            sortableColumns={PARCEL_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Package}
                title="No parcels match these filters"
                description={
                  search.search || search.status || search.paymentType || search.hubId
                    ? "Try a different tracking number, or clear the filters to see everything in your scope."
                    : "Nothing has been booked in your scope yet. Create the first parcel, or ask a hub operator to book on a customer's behalf."
                }
                action={
                  hasPermission("parcels.create") ? (
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus />
                      New parcel
                    </Button>
                  ) : null
                }
              />
            }
            rowActions={(parcel) => <ParcelRowActions parcel={parcel} />}
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) => patch({ sortBy: sortBy as ParcelSortColumn, sort })}
          />
        </CardContent>
      </Card>

      <ParcelCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void query.refetch()}
      />
    </div>
  )
}

function ParcelRowActions({ parcel }: { parcel: Parcel }) {
  const navigate = useNavigate()

  function copyTracking() {
    void navigator.clipboard
      .writeText(parcel.trackingNumber)
      .then(() => AppToast.success("Tracking number copied"))
      .catch(() => AppToast.failure("Could not copy to the clipboard"))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Parcel actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-mono text-xs">{parcel.trackingNumber}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/parcels/$parcelId" params={{ parcelId: parcel.id }}>
            Open parcel
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={copyTracking}>
          <Copy />
          Copy tracking number
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            void navigate({ to: "/tracking", search: { tracking: parcel.trackingNumber } })
          }
        >
          <Truck />
          Track
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
