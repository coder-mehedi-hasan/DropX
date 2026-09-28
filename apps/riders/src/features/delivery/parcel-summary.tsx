import { Banknote, MapPin, PackageSearch, Phone, TriangleAlert, User } from "lucide-react"
import type { ReactNode } from "react"
import {
  Badge,
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

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
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
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-xl break-all">{job.parcel.trackingNumber}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Badge variant={isCod ? "warning" : "outline"}>
              {isCod ? "Cash on delivery" : "Prepaid"}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <StatusRow label="Parcel status">
              <StatusBadge status={job.parcel.status} />
            </StatusRow>
            <StatusRow label="Delivery attempt">
              <DeliveryAttemptBadge delivery={job.delivery} />
            </StatusRow>
            <DetailRow label="Weight" value={formatWeight(job.parcel.weight)} />
            <DetailRow
              label="To collect"
              value={isCod ? formatMoney(job.parcel.codAmount) : "Nothing to collect"}
            />
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

      {isCod ? (
        <Card>
          <CardContent className="flex items-start gap-3 py-4">
            <Banknote className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="text-sm">
              Collect <span className="font-semibold">{formatMoney(job.parcel.codAmount)}</span> in
              cash before handing the parcel over, then hand it in through settlements.
            </p>
          </CardContent>
        </Card>
      ) : null}

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

      {/*
        The drop-off details come off the delivery attempt rather than the customer
        record: the address on the attempt is the one dispatch actually planned this
        leg against, and it is the one the rider can act on.
      */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where to deliver</CardTitle>
          <CardDescription>From attempt {job.delivery.attemptNo} on this job.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <p className="flex items-center gap-2 font-medium">
            <User className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">
              {job.delivery.recipientName ?? "No recipient name on file"}
            </span>
          </p>
          {job.delivery.recipientPhone ? (
            <p className="flex items-center gap-2 text-sm" data-numeric>
              <Phone className="text-muted-foreground size-4 shrink-0" aria-hidden />
              {job.delivery.recipientPhone}
            </p>
          ) : null}
          <p className="flex items-start gap-2 text-sm">
            <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{job.delivery.address}</span>
          </p>
        </CardContent>
      </Card>

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
