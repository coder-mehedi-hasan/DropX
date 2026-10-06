"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  DataTable,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusBadge,
  cn,
  parcelStatusLabel,
  type DataTableColumn,
} from "@dropx/ui"
import {
  CircleCheckIcon,
  PackageIcon,
  PackageOpenIcon,
  SearchIcon,
  TriangleAlertIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { isApiError } from "@/lib/api-client"
import { formatDateTime, formatMoney, formatWeight } from "@/lib/format"
import { useMyParcels } from "@/lib/queries"
import { PARCEL_STATUSES, type ListQueryParams, type Parcel, type ParcelStatus } from "@/lib/types"

const PAGE_SIZE = 20

/**
 * The customer's own parcel list.
 *
 * Reads `/customer/parcels` and never the staff `/admin/parcels` collection: the
 * API refuses a customer token there, and a client that reached for it would show
 * an empty table rather than an obvious mistake.
 */
export function ParcelList() {
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState<ParcelStatus | "ALL">("ALL")
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const params = React.useMemo<ListQueryParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      sortBy: "createdAt",
      sort: "desc",
      ...(search ? { search } : {}),
      ...(status === "ALL" ? {} : { status }),
    }),
    [page, search, status],
  )

  const query = useMyParcels(params)
  const parcels = query.data?.nodes ?? []
  const meta = query.data?.meta
  const isFiltered = search !== "" || status !== "ALL"

  const summary = React.useMemo(() => {
    const activeStatuses = new Set<ParcelStatus>([
      "PICKED_UP",
      "IN_TRANSIT",
      "AT_HUB",
      "OUT_FOR_DELIVERY",
    ])
    const attentionStatuses = new Set<ParcelStatus>(["FAILED", "RETURNED"])

    return {
      total: meta?.totalCount ?? parcels.length,
      active: parcels.filter((parcel) => activeStatuses.has(parcel.status)).length,
      delivered: parcels.filter((parcel) => parcel.status === "DELIVERED").length,
      attention: parcels.filter((parcel) => attentionStatuses.has(parcel.status)).length,
    }
  }, [meta?.totalCount, parcels])

  const errorMessage = isApiError(query.error) ? query.error.message : null

  const columns = React.useMemo<DataTableColumn<Parcel>[]>(
    () => [
      {
        id: "trackingNumber",
        header: "Tracking number",
        cell: (parcel) => (
          <Link
            href={`/parcels/${parcel.id}`}
            className="text-accent-ink hover:text-accent-ink-hover font-mono text-sm font-semibold hover:underline"
          >
            {parcel.trackingNumber}
          </Link>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (parcel) => <StatusBadge status={parcel.status} />,
        value: (parcel) => parcel.status,
      },
      { id: "parcelType", header: "Type", value: (parcel) => parcel.parcelType },
      {
        id: "paymentType",
        header: "Payment",
        value: (parcel) =>
          parcel.paymentType === "COD" ? `COD · ${formatMoney(parcel.codAmount)}` : "Prepaid",
      },
      {
        id: "weight",
        header: "Weight",
        numeric: true,
        cell: (parcel) => formatWeight(parcel.weight),
        value: (parcel) => parcel.weight,
      },
      {
        id: "deliveryFee",
        header: "Fee",
        numeric: true,
        cell: (parcel) => formatMoney(parcel.deliveryFee),
        value: (parcel) => parcel.deliveryFee,
      },
      {
        id: "createdAt",
        header: "Booked",
        cell: (parcel) => (
          <span className="text-muted-foreground">{formatDateTime(parcel.createdAt)}</span>
        ),
        value: (parcel) => parcel.createdAt,
      },
    ],
    [],
  )

  return (
    <div className="grid gap-6">
      <section
        aria-label="Shipment pulse"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr]"
      >
        <MetricCard
          dark
          icon={PackageIcon}
          label="All parcels"
          value={summary.total}
          note={isFiltered ? "Matching this view" : "Across your account"}
        />
        <MetricCard
          icon={TruckIcon}
          label="On the way"
          value={summary.active}
          note="On this page"
          accent="orange"
        />
        <MetricCard
          icon={CircleCheckIcon}
          label="Delivered"
          value={summary.delivered}
          note="On this page"
          accent="green"
        />
        <MetricCard
          icon={TriangleAlertIcon}
          label="Needs attention"
          value={summary.attention}
          note="Failed or returned"
          accent="amber"
        />
      </section>

      {errorMessage ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>We could not load your parcels</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-28px_rgba(13,15,18,.28)] ring-1 ring-black/5">
        <div className="grid gap-4 border-b border-black/6 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_minmax(20rem,.9fr)] lg:items-end">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">Shipments</h2>
              {!query.isPending ? (
                <span className="rounded-md bg-[#0D0F12] px-2 py-0.5 text-[0.65rem] font-semibold text-white tabular-nums">
                  {meta?.totalCount ?? parcels.length}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Search, filter, and open a parcel to see its journey.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                strokeWidth={1.75}
                aria-hidden
              />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search tracking number"
                className="h-11 border-black/10 bg-[#F7F8FA] pl-9 shadow-none"
                aria-label="Search parcels by tracking number"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value === "ALL" ? "ALL" : (value as ParcelStatus))
                setPage(1)
              }}
            >
              <SelectTrigger
                className="h-11 w-full border-black/10 bg-[#F7F8FA] shadow-none sm:w-48"
                aria-label="Filter by status"
              >
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {PARCEL_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {parcelStatusLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardContent className="p-0 sm:p-0">
          {query.isPending ? (
            <div className="p-4">
              <ListSkeleton />
            </div>
          ) : null}

          {!query.isPending && parcels.length === 0 && !errorMessage ? (
            <EmptyState
              icon={PackageOpenIcon}
              title={
                isFiltered ? "No parcels match those filters" : "You have not booked a parcel yet"
              }
              description={
                isFiltered
                  ? "Try a different tracking number, or clear the status filter."
                  : "Book a parcel and it will show up here with its tracking number."
              }
              action={
                isFiltered ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchInput("")
                      setSearch("")
                      setStatus("ALL")
                      setPage(1)
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/book">Book a parcel</Link>
                  </Button>
                )
              }
            />
          ) : null}

          {parcels.length > 0 ? (
            <div className="grid">
              <DataTable
                data={parcels}
                columns={columns}
                rowId={(parcel) => parcel.id}
                caption={`Your ${parcels.length} parcels`}
                variant="minimal"
                density="relaxed"
                keyboardNavigation={false}
                clipboard={false}
              />

              <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                <p>
                  {meta
                    ? `Showing ${(meta.currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                        meta.currentPage * PAGE_SIZE,
                        meta.totalCount,
                      )} of ${meta.totalCount}`
                    : null}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={!meta?.hasPreviousPage}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={!meta?.hasNextPage}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  dark = false,
  icon: Icon,
  label,
  value,
  note,
  accent = "neutral",
}: {
  dark?: boolean
  icon: LucideIcon
  label: string
  value: number
  note: string
  accent?: "neutral" | "orange" | "green" | "amber"
}) {
  const iconClass = {
    neutral: "bg-muted text-foreground",
    orange: "bg-primary/10 text-accent-ink",
    green: "bg-status-delivered/10 text-success",
    amber: "bg-status-out-for-delivery/10 text-warning",
  }[accent]

  return (
    <div
      className={cn(
        "relative min-h-36 overflow-hidden rounded-2xl p-5",
        dark
          ? "bg-[#0D0F12] text-white shadow-[0_18px_40px_-24px_rgba(13,15,18,.85)]"
          : "text-foreground bg-white shadow-[0_12px_32px_-26px_rgba(13,15,18,.55)] ring-1 ring-black/5",
      )}
    >
      {dark ? (
        <div className="pointer-events-none absolute -top-16 -right-10 size-40 rounded-full bg-[#FF5500]/20 blur-2xl" />
      ) : null}
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p
            className={cn("text-sm font-medium", dark ? "text-white/60" : "text-muted-foreground")}
          >
            {label}
          </p>
          <p className="mt-3 text-3xl font-extrabold tracking-[-0.04em] tabular-nums">{value}</p>
        </div>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            dark ? "bg-white/10 text-[#FF8A4C]" : iconClass,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className={cn("relative mt-3 text-xs", dark ? "text-white/45" : "text-muted-foreground")}>
        {note}
      </p>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-12" />
      ))}
      <span className="sr-only">Loading your parcels</span>
    </div>
  )
}
