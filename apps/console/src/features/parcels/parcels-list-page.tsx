import { useQuery } from "@tanstack/react-query"
import { PARCEL_STATUSES, PAYMENT_TYPES } from "@dropx/db/entities"
import type { ParcelStatus, PaymentType } from "@dropx/db/entities"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Truck,
} from "lucide-react"
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  parcelStatusLabel,
} from "@dropx/ui"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listParcels } from "@/lib/endpoints"
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format"
import { paymentFilter, statusFilter } from "@/lib/parcels"
import type { Parcel, ParcelListParams, ParcelSortColumn } from "@/lib/parcels"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import type { ParcelsSearch } from "@/routes/search-params"

import { ParcelCreateDialog } from "./parcel-create-dialog"

const ALL = "ALL"
const PAGE_SIZES = [10, 20, 50, 100] as const

export function ParcelsListPage({ search }: { search: ParcelsSearch }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)

  // The URL takes the keystroke; only the debounced value costs a request.
  const debouncedSearch = useDebouncedValue(search.search.trim(), 300)

  const params = useMemo<ParcelListParams>(
    () => ({
      page: search.page,
      limit: search.limit,
      sortBy: search.sortBy,
      sort: search.sort,
      search: debouncedSearch || undefined,
      status: statusFilter(search.status),
      paymentType: paymentFilter(search.paymentType),
      hubId: search.hubId,
    }),
    [
      search.page,
      search.limit,
      search.sortBy,
      search.sort,
      debouncedSearch,
      search.status,
      search.paymentType,
      search.hubId,
    ],
  )

  const query = useQuery({
    queryKey: ["parcels", params],
    queryFn: ({ signal }) => listParcels(params, signal),
  })

  /**
   * Every list mutation resets to page 1 — page 4 of a new result set is empty.
   * The whole validated object is written rather than a partial, because an
   * omitted key would otherwise keep its previous value.
   */
  function patch(next: Partial<ParcelsSearch>, options?: { keepPage?: boolean }) {
    void navigate({
      to: "/parcels",
      search: { ...search, ...next, ...(options?.keepPage ? {} : { page: 1 }) },
    })
  }

  function toggleSort(sortBy: ParcelSortColumn) {
    const sameColumn = search.sortBy === sortBy
    patch({ sortBy, sort: sameColumn && search.sort === "asc" ? "desc" : "asc" })
  }

  const meta = query.data?.meta
  const nodes = query.data?.nodes ?? []
  const firstRow = meta && meta.totalCount > 0 ? (meta.currentPage - 1) * search.limit + 1 : 0
  const lastRow = meta ? Math.min(meta.currentPage * search.limit, meta.totalCount) : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
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
            <div className="relative min-w-56 flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search.search}
                onChange={(event) => patch({ search: event.target.value })}
                placeholder="Tracking number, receiver name or phone"
                className="pl-8"
                aria-label="Search parcels"
              />
            </div>

            <Select
              value={search.status || ALL}
              onValueChange={(value) =>
                patch({ status: value === ALL ? undefined : (value as ParcelStatus) })
              }
            >
              <SelectTrigger size="sm" className="w-44" aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {PARCEL_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {parcelStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={search.paymentType || ALL}
              onValueChange={(value) =>
                patch({ paymentType: value === ALL ? undefined : (value as PaymentType) })
              }
            >
              <SelectTrigger size="sm" className="w-36" aria-label="Filter by payment type">
                <SelectValue placeholder="All payments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All payments</SelectItem>
                {PAYMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "COD" ? "Cash on delivery" : "Prepaid"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {search.status || search.paymentType || search.search ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => patch({ search: "", status: undefined, paymentType: undefined })}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {query.isPending ? (
            <ParcelsTableSkeleton />
          ) : query.isError ? null : nodes.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Package}
                title="No parcels match these filters"
                description={
                  search.search || search.status || search.paymentType
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
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Tracking"
                    column="trackingNumber"
                    active={search.sortBy}
                    order={search.sort}
                    onSort={toggleSort}
                  />
                  <SortableHead
                    label="Status"
                    column="status"
                    active={search.sortBy}
                    order={search.sort}
                    onSort={toggleSort}
                  />
                  <TableHead>Receiver</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Payment</TableHead>
                  <SortableHead
                    label="Weight"
                    column="weight"
                    active={search.sortBy}
                    order={search.sort}
                    onSort={toggleSort}
                    align="right"
                  />
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">COD</TableHead>
                  <SortableHead
                    label="Created"
                    column="createdAt"
                    active={search.sortBy}
                    order={search.sort}
                    onSort={toggleSort}
                  />
                  <TableHead className="w-10">
                    <span className="sr-only">Row actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodes.map((parcel) => (
                  <ParcelRow key={parcel.id} parcel={parcel} />
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground text-xs font-normal">
                    {meta ? `${firstRow}–${lastRow} of ${formatNumber(meta.totalCount)}` : "—"}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {meta && meta.totalPages > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Rows per page</span>
            <Select
              value={String(search.limit)}
              onValueChange={(value) => patch({ limit: Number(value) })}
            >
              <SelectTrigger size="sm" className="w-20" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              Page {meta.currentPage} of {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPreviousPage || query.isFetching}
              onClick={() => patch({ page: meta.currentPage - 1 }, { keepPage: true })}
            >
              <ChevronLeft />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNextPage || query.isFetching}
              onClick={() => patch({ page: meta.currentPage + 1 }, { keepPage: true })}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}

      <ParcelCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void query.refetch()}
      />
    </div>
  )
}

function SortableHead({
  label,
  column,
  active,
  order,
  onSort,
  align = "left",
}: {
  label: string
  column: ParcelSortColumn
  active: ParcelSortColumn
  order: "asc" | "desc"
  onSort: (column: ParcelSortColumn) => void
  align?: "left" | "right"
}) {
  const sorted = active === column
  const Icon = !sorted ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    </TableHead>
  )
}

function ParcelRow({ parcel }: { parcel: Parcel }) {
  const navigate = useNavigate()

  function copyTracking() {
    void navigator.clipboard
      .writeText(parcel.trackingNumber)
      .then(() => toast.success("Tracking number copied"))
      .catch(() => toast.error("Could not copy to the clipboard"))
  }

  return (
    <TableRow>
      <TableCell>
        <Link
          to="/parcels/$parcelId"
          params={{ parcelId: parcel.id }}
          className="font-mono text-xs font-medium underline-offset-4 hover:underline"
        >
          {parcel.trackingNumber}
        </Link>
      </TableCell>
      <TableCell>
        <StatusBadge status={parcel.status} />
      </TableCell>
      <TableCell className="text-muted-foreground max-w-52 truncate text-sm">
        <span className="text-foreground block font-medium">
          Customer #{parcel.receiverCustomerId}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{parcel.parcelType}</Badge>
      </TableCell>
      <TableCell>
        {parcel.paymentType === "COD" ? (
          <Badge variant="warning">COD</Badge>
        ) : (
          <Badge variant="outline">Prepaid</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">{formatNumber(parcel.weight)} kg</TableCell>
      <TableCell className="text-right font-medium">{formatMoney(parcel.deliveryFee)}</TableCell>
      <TableCell className="text-muted-foreground text-right">
        {parcel.codAmount > 0 ? formatMoney(parcel.codAmount) : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDateTime(parcel.createdAt)}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Parcel actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-mono text-xs">
              {parcel.trackingNumber}
            </DropdownMenuLabel>
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
      </TableCell>
    </TableRow>
  )
}

function ParcelsTableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 10 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  )
}
