import { Link } from "@tanstack/react-router"
import { Banknote, ChevronRight, Package } from "lucide-react"
import { Badge, Card, CardContent, CardHeader, CardTitle, StatusBadge } from "@dropx/ui"

import type { Job } from "../../lib/domain"
import { formatMoney, formatWeight } from "../../lib/format"
import { DeliveryAttemptBadge } from "../delivery/delivery-attempt-badge"

/**
 * One job, sized for a thumb.
 *
 * The recipient and the drop address come off the delivery attempt, because that
 * is the leg this rider owns. Both statuses are shown and both are labelled — the
 * attempt is what the rider moves, the parcel status is what the customer is
 * told, and a rider who reads only one of them misreports the delivery. The COD
 * row is only rendered for cash-on-delivery parcels so a prepaid parcel does not
 * make a rider look for money that is not there.
 */
export function JobCard({ job }: { job: Job }) {
  const isCod = job.parcel.paymentType === "COD"

  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.parcel.id }}
      className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="active:bg-accent gap-3 py-4 transition-colors">
        <CardHeader className="px-4">
          <CardTitle data-numeric className="font-mono text-lg tracking-tight break-all">
            {job.parcel.trackingNumber}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {isCod ? (
              <Badge variant="warning">
                <Banknote aria-hidden />
                COD {formatMoney(job.parcel.codAmount)}
              </Badge>
            ) : (
              <Badge variant="outline">Prepaid</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4">
          <div>
            <p className="truncate font-medium">
              {job.delivery.recipientName ?? "No recipient name on file"}
            </p>
            <p className="text-muted-foreground line-clamp-2 text-sm">{job.delivery.address}</p>
          </div>

          <div className="flex items-end justify-between gap-3">
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <dt className="text-muted-foreground text-xs">Parcel</dt>
                <dd>
                  <StatusBadge status={job.parcel.status} />
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-muted-foreground text-xs">Attempt</dt>
                <dd>
                  <DeliveryAttemptBadge delivery={job.delivery} />
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-muted-foreground text-xs">Weight</dt>
                <dd data-numeric className="font-medium">
                  {formatWeight(job.parcel.weight)}
                </dd>
              </div>
            </dl>
            <ChevronRight className="text-muted-foreground size-6 shrink-0" aria-hidden />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function JobCardSkeleton() {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="gap-2 px-4">
        <div className="bg-accent h-6 w-40 animate-pulse rounded-md" />
        <div className="bg-accent h-5 w-56 animate-pulse rounded-md" />
      </CardHeader>
      <CardContent className="px-4">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Package className="size-4" aria-hidden />
          Loading job
        </div>
      </CardContent>
    </Card>
  )
}
