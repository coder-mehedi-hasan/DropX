import { Link } from "@tanstack/react-router"
import { Banknote, ChevronRight, MapPin, Package } from "lucide-react"
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
      className="focus-visible:ring-ring block rounded-[1.25rem] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card className="rider-job-card hover:border-primary/25 active:bg-accent relative gap-0 overflow-hidden rounded-[1.25rem] border-transparent py-0 transition-all duration-200 hover:-translate-y-0.5">
        <div className="bg-primary absolute inset-y-0 left-0 w-1" aria-hidden />
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-5 py-3.5">
          <CardTitle
            data-numeric
            className="font-mono text-sm font-semibold tracking-tight break-all"
          >
            {job.parcel.trackingNumber}
          </CardTitle>
          <StatusBadge status={job.parcel.status} />
        </CardHeader>

        <CardContent className="grid gap-4 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tracking-tight">
                {job.delivery.recipientName ?? "No recipient name on file"}
              </p>
              {/*
                The structured address line is the primary drop; the dispatch
                snapshot is the fallback for parcels booked before the structured
                migration. Area and city ride beneath so a rider can read the
                drop at a glance without opening the job.
              */}
              <p className="text-muted-foreground mt-1 flex items-start gap-1.5 text-sm leading-5">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="line-clamp-2">
                  {job.delivery.addressLine ?? job.delivery.address}
                </span>
              </p>
              {job.delivery.areaName || job.delivery.cityName ? (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {[job.delivery.areaName, job.delivery.zoneName, job.delivery.cityName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-xl">
              <ChevronRight className="text-muted-foreground size-5" aria-hidden />
            </span>
          </div>

          <div className="bg-muted/70 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
            {isCod ? (
              <div className="flex items-center gap-2">
                <Banknote className="text-muted-foreground size-4" strokeWidth={1.75} aria-hidden />
                <span>
                  <span className="text-muted-foreground block text-[0.65rem] font-semibold tracking-wide uppercase">
                    Collect cash
                  </span>
                  <span
                    data-numeric
                    className="block text-lg leading-tight font-extrabold tracking-tight"
                  >
                    {formatMoney(job.parcel.codAmount)}
                  </span>
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
