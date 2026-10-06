import { Link } from "@tanstack/react-router"
import { Banknote, ChevronRight, Package } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, StatusBadge } from "@dropx/ui"

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
      <Card className="active:bg-accent gap-0 overflow-hidden py-0 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-4 py-3">
          <CardTitle data-numeric className="font-mono text-base tracking-tight break-all">
            {job.parcel.trackingNumber}
          </CardTitle>
          <StatusBadge status={job.parcel.status} />
        </CardHeader>

        <CardContent className="grid gap-4 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">
                {job.delivery.recipientName ?? "No recipient name on file"}
              </p>
              {/*
                The structured address line is the primary drop; the dispatch
                snapshot is the fallback for parcels booked before the structured
                migration. Area and city ride beneath so a rider can read the
                drop at a glance without opening the job.
              */}
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
                {job.delivery.addressLine ?? job.delivery.address}
              </p>
              {job.delivery.areaName || job.delivery.cityName ? (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {[job.delivery.areaName, job.delivery.zoneName, job.delivery.cityName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            <ChevronRight className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
          </div>

          <div className="bg-muted/60 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
            {isCod ? (
              <div className="flex items-center gap-2">
                <Banknote className="text-muted-foreground size-4" strokeWidth={1.75} aria-hidden />
                <span className="text-muted-foreground text-xs font-medium">Collect</span>
                <span data-numeric className="text-base font-bold">
                  {formatMoney(job.parcel.codAmount)}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm font-medium">Prepaid · no cash</span>
            )}
            <div className="flex items-center gap-3 text-xs">
              <span data-numeric className="text-muted-foreground font-medium">
                {formatWeight(job.parcel.weight)}
              </span>
              <DeliveryAttemptBadge delivery={job.delivery} />
            </div>
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
