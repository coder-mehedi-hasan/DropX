import { cn } from "../../lib/cn"
import { Badge, type BadgeProps } from "./badge"

/**
 * Human-readable parcel status labels.
 *
 * Hand-written rather than derived by splitting on `_`: `OUT_FOR_DELIVERY` should
 * read "Out for delivery", not "Out for delivery" with an inferred capitalisation
 * that gets `AT_HUB` and `IN_TRANSIT` wrong. The record is exhaustive so adding a
 * status to the API forces a decision here instead of silently falling through.
 */
const PARCEL_STATUS_LABELS: Record<string, string> = {
  CREATED: "Created",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  AT_HUB: "At hub",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Delivery failed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
}

/**
 * Status → the `--status-*` token it is painted in.
 *
 * The palette is the brand's, which has no blue, so the six roles come out of the
 * colours it does ship: Volt Orange is "progress", Alert Amber is "attention",
 * Terminal Green is "complete", Carbon is "not moving yet or finished quietly",
 * and red is "blocked". `CANCELLED` borrows the neutral Carbon — cancellation is
 * terminal and not alarming, unlike `FAILED`.
 *
 * Written out in full rather than interpolated from a token name because Tailwind
 * scans source text for complete class strings; a `bg-status-${role}` template
 * would compile to nothing.
 */
const PARCEL_STATUS_CLASSES: Record<string, string> = {
  CREATED: "border-status-created/30 bg-status-created/10",
  PICKED_UP: "border-status-in-transit/30 bg-status-in-transit/10",
  IN_TRANSIT: "border-status-in-transit/30 bg-status-in-transit/10",
  AT_HUB: "border-status-in-transit/30 bg-status-in-transit/10",
  OUT_FOR_DELIVERY: "border-status-out-for-delivery/30 bg-status-out-for-delivery/10",
  DELIVERED: "border-status-delivered/30 bg-status-delivered/10",
  FAILED: "border-status-failed/30 bg-status-failed/10",
  RETURNED: "border-status-returned/30 bg-status-returned/10",
  CANCELLED: "border-status-created/30 bg-status-created/10",
}

/** The brand's status dot, in the same hue as its tint. */
const PARCEL_STATUS_DOTS: Record<string, string> = {
  CREATED: "bg-status-created",
  PICKED_UP: "bg-status-in-transit",
  IN_TRANSIT: "bg-status-in-transit",
  AT_HUB: "bg-status-in-transit",
  OUT_FOR_DELIVERY: "bg-status-out-for-delivery",
  DELIVERED: "bg-status-delivered",
  FAILED: "bg-status-failed",
  RETURNED: "bg-status-returned",
  CANCELLED: "bg-status-created",
}

const UNKNOWN_STATUS = "CREATED"

/** The brand's one-pixel dot: the non-colour half of the status signal. */
function StatusDot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", className)} />
}

/**
 * parcelStatusLabel.
 *
 * Falls back to the raw value so an unmigrated status from the API stays visible in
 * the UI instead of rendering as an empty badge — a visible unknown status is a bug
 * report, a blank cell is a silent one.
 */
export function parcelStatusLabel(status: string): string {
  return PARCEL_STATUS_LABELS[status] ?? status
}

/**
 * StatusBadge.
 *
 * Takes the raw API status string because that is what every DropX screen already
 * has; callers should not have to map it to a variant before rendering it.
 *
 * The label is painted in ink and the status colour appears as a dot beside it,
 * never as the text colour. That is not a stylistic choice: the brand requires
 * every status colour to be paired with a label rather than carried alone, and it
 * is also the only arrangement in which the vivid palette is legal on a light
 * surface — Terminal Green is 2.24:1 on white as type, and 8.6:1 as a 6px dot.
 * Unknown statuses still render with the neutral dot and the raw value, so the
 * table layout doesn't collapse while the API catches up.
 */
export function StatusBadge({
  status,
  className,
  ...props
}: Omit<BadgeProps, "children"> & { status: string }) {
  const statusClass = PARCEL_STATUS_CLASSES[status] ?? PARCEL_STATUS_CLASSES[UNKNOWN_STATUS]!
  const dotClass = PARCEL_STATUS_DOTS[status] ?? PARCEL_STATUS_DOTS[UNKNOWN_STATUS]!

  return (
    <Badge
      data-slot="status-badge"
      variant="outline"
      className={cn("gap-1.5 font-medium", statusClass, className)}
      {...props}
    >
      <StatusDot className={dotClass} />
      {parcelStatusLabel(status)}
    </Badge>
  )
}
