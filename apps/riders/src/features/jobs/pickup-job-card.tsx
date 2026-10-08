import { ArrowRight, Check, MapPin, Package } from "lucide-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@dropx/ui"

import type { RiderPickupJob } from "../../lib/domain"
import { formatMoney, formatWeight } from "../../lib/format"

const PICKUP_STATUS_LABELS = {
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  PICKED_UP: "Picked up",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
} as const

export function PickupJobCard({
  job,
  onAction,
  busy = false,
}: {
  job: RiderPickupJob
  onAction: (job: RiderPickupJob) => void
  busy?: boolean
}) {
  const nextAction =
    job.pickup.status === "ASSIGNED"
      ? "Start pickup"
      : job.pickup.status === "IN_PROGRESS"
        ? "Mark picked up"
        : null

  return (
    <Card className="rider-job-card relative overflow-hidden rounded-[1.25rem] border-transparent py-0">
      <div className="bg-primary absolute inset-y-0 left-0 w-1" aria-hidden />
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-5 py-3.5">
        <CardTitle data-numeric className="font-mono text-sm break-all">
          {job.parcel.trackingNumber}
        </CardTitle>
        <Badge variant="outline">{PICKUP_STATUS_LABELS[job.pickup.status]}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground flex items-start gap-1.5 text-sm leading-5">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-3">{job.pickup.address}</span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">Parcel collection</p>
          </div>
          <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-xl">
            <Package className="text-muted-foreground size-5" aria-hidden />
          </span>
        </div>
        <div className="bg-muted/70 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
          <span className="text-muted-foreground text-sm font-medium">
            {job.parcel.paymentType === "COD"
              ? `COD ${formatMoney(job.parcel.codAmount)}`
              : "Prepaid"}
          </span>
          <span data-numeric className="text-muted-foreground text-xs font-medium">
            {formatWeight(job.parcel.weight)}
          </span>
        </div>
        {nextAction ? (
          <div className="border-primary/15 bg-primary/[0.06] rounded-xl border p-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Next step
            </p>
            <p className="mt-1 text-sm font-semibold">
              {job.pickup.status === "ASSIGNED"
                ? "Go to the collection address and start the pickup."
                : "Confirm that you have collected the parcel."}
            </p>
            <Button
              type="button"
              size="lg"
              className="tap-target mt-3 w-full justify-between rounded-xl"
              disabled={busy}
              onClick={() => onAction(job)}
            >
              {busy ? "Updating…" : nextAction}
              {job.pickup.status === "IN_PROGRESS" ? (
                <Check aria-hidden />
              ) : (
                <ArrowRight aria-hidden />
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
