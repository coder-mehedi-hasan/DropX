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
  parcelStatusLabel,
  type DataTableColumn,
} from "@dropx/ui"
import { PackageOpenIcon, SearchIcon, TriangleAlertIcon } from "lucide-react"
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
    <div className="grid gap-4">
      <Card className="bg-card/60 border-0 shadow-sm">
        <CardContent className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1">
            <p className="text-sm font-semibold">Find a parcel</p>
            <p className="text-muted-foreground text-xs">
              Search by tracking number or narrow by status.
            </p>
          </div>
          <div className="relative">
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by tracking number"
              className="pl-9"
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
            <SelectTrigger className="w-full sm:w-56" aria-label="Filter by status">
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
        </CardContent>
      </Card>

      {errorMessage ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>We could not load your parcels</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="p-3 sm:p-5">
          {query.isPending ? <ListSkeleton /> : null}

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
            <div className="grid gap-4">
              <DataTable
                data={parcels}
                columns={columns}
                rowId={(parcel) => parcel.id}
                caption={`Your ${parcels.length} parcels`}
                variant="bordered"
                keyboardNavigation={false}
                clipboard={false}
              />

              <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-sm">
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
