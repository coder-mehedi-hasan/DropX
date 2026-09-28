"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
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
  TableHead,
  TableHeader,
  TableRow,
  parcelStatusLabel,
} from "@dropx/ui"
import { PackageOpenIcon, SearchIcon, TriangleAlertIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { isApiError } from "@/lib/api-client"
import { formatDateTime, formatMoney, formatWeight } from "@/lib/format"
import { useMyParcels } from "@/lib/queries"
import { PARCEL_STATUSES, type ListQueryParams, type ParcelStatus } from "@/lib/types"

const PAGE_SIZE = 20

/**
 * The customer's own parcel list.
 *
 * Reads `/parcels/mine/list` and never the staff `/parcels` collection: the API
 * refuses a customer token there, and a client that reached for it would show an
 * empty table rather than an obvious mistake.
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

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
        <CardContent>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead>Booked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcels.map((parcel) => (
                    <TableRow key={parcel.id}>
                      <TableCell>
                        <Link
                          href={`/parcels/${parcel.id}`}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          {parcel.trackingNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={parcel.status} />
                      </TableCell>
                      <TableCell>{parcel.parcelType}</TableCell>
                      <TableCell>
                        {parcel.paymentType === "COD"
                          ? `COD · ${formatMoney(parcel.codAmount)}`
                          : "Prepaid"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatWeight(parcel.weight)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(parcel.deliveryFee)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(parcel.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

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
