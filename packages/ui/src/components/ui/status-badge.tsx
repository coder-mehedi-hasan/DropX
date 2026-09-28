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
 * Status → `--status-*` token class.
 *
 * Maps to the shared status colours so the console table, the rider job card and
 * the customer's tracking view all render the same status identically. `CANCELLED`
 * has no dedicated token in `styles.css`, so it borrows the neutral `created`
 * grey — cancellation is a terminal, non-alarming state, unlike `FAILED`.
 */
const PARCEL_STATUS_CLASSES: Record<string, string> = {
  CREATED: "border-status-created/30 bg-status-created/10 text-status-created",
  PICKED_UP: "border-status-in-transit/30 bg-status-in-transit/10 text-status-in-transit",
  IN_TRANSIT: "border-status-in-transit/30 bg-status-in-transit/10 text-status-in-transit",
  AT_HUB: "border-status-in-transit/30 bg-status-in-transit/10 text-status-in-transit",
  OUT_FOR_DELIVERY:
    "border-status-out-for-delivery/30 bg-status-out-for-delivery/10 text-status-out-for-delivery",
  DELIVERED: "border-status-delivered/30 bg-status-delivered/10 text-status-delivered",
  FAILED: "border-status-failed/30 bg-status-failed/10 text-status-failed",
  RETURNED: "border-status-returned/30 bg-status-returned/10 text-status-returned",
  CANCELLED: "border-status-created/30 bg-status-created/10 text-status-created",
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
 * has; callers should not have to map it to a variant before rendering it. Unknown
 * statuses still render as an `outline` badge with the raw value, so the table
 * layout doesn't collapse while the API catches up.
 */
export function StatusBadge({
  status,
  className,
  ...props
}: Omit<BadgeProps, "children"> & { status: string }) {
  const statusClass = PARCEL_STATUS_CLASSES[status]

  return (
    <Badge
      data-slot="status-badge"
      variant="outline"
      className={cn(statusClass, className)}
      {...props}
    >
      {parcelStatusLabel(status)}
    </Badge>
  )
}
