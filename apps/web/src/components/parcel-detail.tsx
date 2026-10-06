"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Separator,
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
import { ArrowLeftIcon, PackageOpenIcon, TriangleAlertIcon } from "lucide-react"
import Link from "next/link"

import { EventTimeline } from "@/components/event-timeline"
import { isApiError } from "@/lib/api-client"
import { formatDateTime, formatDimensions, formatMoney, formatWeight } from "@/lib/format"
import { useMyParcel, useTracking } from "@/lib/queries"
import type { Parcel, ParcelAddress } from "@/lib/types"

/**
 * One end of a booking, from the name snapshots the API wrote at booking time.
 * Everything is a string already, so a renamed zone never rewrites the past.
 */
function addressSummary(addresses: ParcelAddress[], type: ParcelAddress["type"]): string {
  const address = addresses.find((item) => item.type === type)
  return address
    ? [address.addressLine, address.areaName, address.zoneName, address.cityName]
        .filter(Boolean)
        .join(", ")
    : "—"
}

/**
 * A customer's own parcel.
 *
 * The portal read (`/customer/parcels/:id`) carries the parcel, its items and
 * both booking addresses but no events, so the timeline comes from the public
 * `/tracking/:trackingNumber` projection — the same data a customer would see
 * without signing in, which is also what the API deliberately exposes for it.
 */
export function ParcelDetail({ parcelId }: { parcelId: string }) {
  const query = useMyParcel(parcelId)
  const parcel = query.data

  const tracking = useTracking(parcel?.trackingNumber ?? "")
  const events = tracking.data?.events

  const errorMessage = isApiError(query.error)
    ? query.error.code === "NOT_FOUND"
      ? "We could not find that parcel on your account."
      : query.error.message
    : null

  if (query.isPending) return <DetailSkeleton />

  if (errorMessage) {
    return (
      <div className="grid gap-4">
        <BackLink />
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>We could not open that parcel</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!parcel) {
    return (
      <div className="grid gap-4">
        <BackLink />
        <EmptyState
          icon={PackageOpenIcon}
          title="Parcel not found"
          description="It may belong to another account, or it may have been removed."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to my parcels</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <BackLink />

      <div className="bg-card rounded-feature grid gap-6 border p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <p className="text-accent-ink text-xs font-semibold tracking-[0.16em] uppercase">
              Parcel
            </p>
            <h1 className="font-mono text-2xl font-bold tracking-tight sm:text-3xl">
              {parcel.trackingNumber}
            </h1>
            <p className="text-muted-foreground text-sm">
              Booked {formatDateTime(parcel.createdAt)} · updated {formatDateTime(parcel.updatedAt)}
            </p>
          </div>
          <StatusBadge status={parcel.status} />
        </div>
        <p className="bg-muted/60 rounded-lg px-4 py-3 text-sm">{statusMessage(parcel.status)}</p>
        <dl className="grid gap-4 border-t pt-5 sm:grid-cols-3">
          <Fact label="Delivery fee" value={formatMoney(parcel.deliveryFee)} />
          <Fact
            label="Payment"
            value={
              parcel.paymentType === "COD"
                ? `Cash on delivery · ${formatMoney(parcel.codAmount)}`
                : "Prepaid"
            }
          />
          <Fact label="Weight" value={formatWeight(parcel.weight)} />
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Parcel</CardTitle>
              <CardDescription>
                Route and size. The delivery fee is fixed at booking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Fact label="Type" value={parcel.parcelType} />
                <Fact
                  label="Dimensions (L×W×H)"
                  value={formatDimensions(parcel.length, parcel.width, parcel.height)}
                />
                <Fact label="Pickup" value={addressSummary(parcel.addresses, "PICKUP")} />
                <Fact label="Delivery" value={addressSummary(parcel.addresses, "DELIVERY")} />
                <Fact label="Origin hub" value={`#${parcel.originHubId}`} />
                <Fact label="Destination hub" value={`#${parcel.destinationHubId}`} />
                <Fact
                  label="Current hub"
                  value={parcel.currentHubId ? `#${parcel.currentHubId}` : "—"}
                />
                <Fact label="Receiver" value={parcel.receiverName || "—"} />
              </dl>

              <p className="text-muted-foreground mt-4 text-xs">
                Address names are snapshots from booking time, so they stay correct even if a zone
                is renamed later. Hubs are shown as ids here; the tracking view resolves names.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                What is inside, declared by the sender for the receiver to check on delivery.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {parcel.items.length === 0 ? (
                <EmptyState
                  icon={PackageOpenIcon}
                  title="No items declared"
                  description="The sender did not list the contents of this parcel."
                  className="px-4 py-8"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcel.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="grid gap-0.5">
                            <span className="font-medium">{item.name}</span>
                            {item.description ? (
                              <span className="text-muted-foreground text-xs">
                                {item.description}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(item.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Tracking history</CardTitle>
            <CardDescription>
              {tracking.isPending
                ? "Loading events…"
                : events
                  ? `${events.length} event${events.length === 1 ? "" : "s"} recorded`
                  : "Tracking history is not available right now."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            {tracking.isPending ? (
              <div className="grid gap-3" aria-busy="true">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-14" />
                ))}
              </div>
            ) : events ? (
              <EventTimeline events={events} />
            ) : (
              <p className="text-muted-foreground text-sm">
                The public tracking feed could not be reached, so the event history is missing. The
                parcel itself is unaffected.
              </p>
            )}

            <Separator className="my-4" />
            <Button variant="outline" asChild className="w-full">
              <Link href={`/track?t=${encodeURIComponent(parcel.trackingNumber)}`}>
                Open the public tracking page
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
      <Link href="/dashboard">
        <ArrowLeftIcon aria-hidden />
        All parcels
      </Link>
    </Button>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

function statusMessage(status: Parcel["status"]): string {
  switch (status) {
    case "CREATED":
      return "Your booking is confirmed. DropX will arrange the next handover soon."
    case "PICKED_UP":
      return "The parcel is with DropX and moving into the hub network."
    case "IN_TRANSIT":
      return "The parcel is travelling between hubs."
    case "AT_HUB":
      return "The parcel has arrived at a hub and is being processed."
    case "OUT_FOR_DELIVERY":
      return "A rider is taking the parcel to the receiver today."
    case "DELIVERED":
      return "The parcel has been delivered successfully."
    case "FAILED":
      return "A delivery attempt needs attention. Check the latest tracking event."
    case "CANCELLED":
      return "This parcel has been cancelled."
    case "RETURNED":
      return "This parcel is on its way back to the sender."
    default:
      return `Current status: ${parcelStatusLabel(status)}.`
  }
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-6 w-32" />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-80" />
      </div>
      <span className="sr-only">Loading parcel</span>
    </div>
  )
}
