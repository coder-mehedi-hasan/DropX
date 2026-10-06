import { Banknote, MapPin, PackageSearch, Phone, TriangleAlert, User } from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dropx/ui"

import type { JobDetail } from "../../lib/domain"
import { formatDateTime, formatMoney, formatWeight } from "../../lib/format"
import { DeliveryAttemptBadge } from "./delivery-attempt-badge"

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd data-numeric className="text-right text-sm font-medium">
        {value}
      </dd>
    </div>
  )
}

function areaChain(address: {
  areaName?: string | null
  zoneName?: string | null
  cityName?: string | null
}): string {
  return [address.areaName, address.zoneName, address.cityName].filter(Boolean).join(" · ")
}

/**
 * The job a rider is holding: the parcel the customer is tracking, the attempt
 * they are acting on, and the drop those two legs share.
 *
 * The two statuses are labelled rather than merged, because the API reports an
 * attempt that moved before its parcel did, and a rider who cannot tell which
 * one they are reading will report the wrong outcome.
 */
export function ParcelSummary({ job }: { job: JobDetail }) {
  const isCod = job.parcel.paymentType === "COD"

  return (
    <div className="space-y-3">
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-4 py-4">
          <CardDescription className="text-xs font-medium tracking-wide uppercase">
            Tracking number
          </CardDescription>
          <CardTitle data-numeric className="font-mono text-xl break-all">
            {job.parcel.trackingNumber}
          </CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={job.parcel.status} />
            <DeliveryAttemptBadge delivery={job.delivery} />
          </div>
        </CardHeader>
        <CardContent className="bg-muted/60 flex items-center justify-between gap-3 px-4 py-3">
          {isCod ? (
            <>
              <span className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <Banknote className="size-4" strokeWidth={1.75} aria-hidden />
                Collect in cash
              </span>
              <span data-numeric className="text-2xl font-bold tracking-tight">
                {formatMoney(job.parcel.codAmount)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm font-medium">
              Prepaid · nothing to collect
            </span>
          )}
        </CardContent>
      </Card>

      {/*
        The drop-off details come off the delivery attempt rather than the customer
        record: the address on the attempt is the one dispatch actually planned this
        leg against, and it is the one the rider can act on.
      */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where to deliver</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="flex items-center gap-2 text-base font-semibold">
            <User className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">
              {job.delivery.recipientName ?? "No recipient name on file"}
            </span>
          </p>
          <p className="flex items-start gap-2 text-sm">
            <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">
              {job.delivery.addressLine ?? job.delivery.address}
            </span>
          </p>
          {areaChain(job.delivery) ? (
            <p className="text-muted-foreground pl-6 text-sm">{areaChain(job.delivery)}</p>
          ) : null}
          {job.delivery.landmark ? (
            <p className="text-muted-foreground pl-6 text-sm break-words">
              Landmark — {job.delivery.landmark}
            </p>
          ) : null}
          {job.delivery.recipientPhone ? (
            <Button asChild variant="outline" size="lg" className="tap-target w-full">
              <a href={`tel:${job.delivery.recipientPhone}`}>
                <Phone aria-hidden />
                <span data-numeric>Call {job.delivery.recipientPhone}</span>
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {job.pickup.addressLine ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where to pick up</CardTitle>
            <CardDescription>For returns or a parcel that comes back.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{job.pickup.addressLine}</span>
            </p>
            {areaChain(job.pickup) ? (
              <p className="text-muted-foreground pl-6 text-sm">{areaChain(job.pickup)}</p>
            ) : null}
            {job.pickup.landmark ? (
              <p className="text-muted-foreground pl-6 text-sm break-words">
                Landmark — {job.pickup.landmark}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <DetailRow label="Weight" value={formatWeight(job.parcel.weight)} />
            <DetailRow label="Booked" value={formatDateTime(job.parcel.createdAt)} />
            {job.delivery.outForDeliveryAt ? (
              <DetailRow
                label="Out for delivery"
                value={formatDateTime(job.delivery.outForDeliveryAt)}
              />
            ) : null}
            {job.delivery.deliveredAt ? (
              <DetailRow label="Delivered" value={formatDateTime(job.delivery.deliveredAt)} />
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {job.delivery.failureReason ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reason on record</CardTitle>
            <CardDescription>
              From attempt {job.delivery.attemptNo}. Dispatch and the sender both read this.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="flex items-start gap-2 text-sm">
              <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{job.delivery.failureReason}</span>
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contents</CardTitle>
          <CardDescription>
            {job.items.length} item{job.items.length === 1 ? "" : "s"} declared on this parcel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {job.items.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No items declared"
              description="This parcel was booked without item detail."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-0">Item</TableHead>
                  <TableHead className="px-0 text-right">Qty</TableHead>
                  <TableHead className="px-0 text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[10rem] px-0 whitespace-normal">
                      <span className="block font-medium">{item.name}</span>
                      {item.description ? (
                        <span className="text-muted-foreground block text-xs">
                          {item.description}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-0 text-right" data-numeric>
                      {item.quantity}
                    </TableCell>
                    <TableCell className="px-0 text-right" data-numeric>
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
  )
}
