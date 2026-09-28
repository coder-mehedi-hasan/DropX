import { cn } from "../../lib/cn"
import { Badge, type BadgeProps } from "./badge"

/**
 * Human-readable parcel-event labels.
 *
 * Tracking timelines speak in events (`ARRIVED_HUB`, `LOADED`), not parcel
 * statuses. Mapping them here keeps admin and customer timelines in sync and
 * stops an event from being painted with a parcel-status palette by accident.
 */
const EVENT_LABELS: Record<string, string> = {
  CREATED: "Created",
  PICKED_UP: "Picked up",
  ARRIVED_HUB: "Arrived at hub",
  DEPARTED_HUB: "Departed hub",
  LOADED: "Loaded",
  UNLOADED: "Unloaded",
  ASSIGNED_RIDER: "Rider assigned",
  IN_TRANSIT: "In transit",
  AT_HUB: "At hub",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
}

/**
 * Event → the same `--status-*` roles the parcel badge uses.
 *
 * Hub/transfer steps are progress (Volt). Delivery outcomes keep the semantic
 * complete / attention / blocked mapping so a timeline never invents a new hue.
 */
const EVENT_CLASSES: Record<string, string> = {
  CREATED: "border-status-created/30 bg-status-created/10",
  PICKED_UP: "border-status-in-transit/30 bg-status-in-transit/10",
  ARRIVED_HUB: "border-status-in-transit/30 bg-status-in-transit/10",
  DEPARTED_HUB: "border-status-in-transit/30 bg-status-in-transit/10",
  LOADED: "border-status-in-transit/30 bg-status-in-transit/10",
  UNLOADED: "border-status-in-transit/30 bg-status-in-transit/10",
  ASSIGNED_RIDER: "border-status-out-for-delivery/30 bg-status-out-for-delivery/10",
  IN_TRANSIT: "border-status-in-transit/30 bg-status-in-transit/10",
  AT_HUB: "border-status-in-transit/30 bg-status-in-transit/10",
  OUT_FOR_DELIVERY: "border-status-out-for-delivery/30 bg-status-out-for-delivery/10",
  DELIVERED: "border-status-delivered/30 bg-status-delivered/10",
  FAILED: "border-status-failed/30 bg-status-failed/10",
  RETURNED: "border-status-returned/30 bg-status-returned/10",
  CANCELLED: "border-status-created/30 bg-status-created/10",
}

const EVENT_DOTS: Record<string, string> = {
  CREATED: "bg-status-created",
  PICKED_UP: "bg-status-in-transit",
  ARRIVED_HUB: "bg-status-in-transit",
  DEPARTED_HUB: "bg-status-in-transit",
  LOADED: "bg-status-in-transit",
  UNLOADED: "bg-status-in-transit",
  ASSIGNED_RIDER: "bg-status-out-for-delivery",
  IN_TRANSIT: "bg-status-in-transit",
  AT_HUB: "bg-status-in-transit",
  OUT_FOR_DELIVERY: "bg-status-out-for-delivery",
  DELIVERED: "bg-status-delivered",
  FAILED: "bg-status-failed",
  RETURNED: "bg-status-returned",
  CANCELLED: "bg-status-created",
}

const UNKNOWN = "CREATED"

function StatusDot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", className)} />
}

export function eventTypeLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.replaceAll("_", " ").toLowerCase()
}

/**
 * EventBadge.
 *
 * Dot + ink label, same contract as `StatusBadge`: colour is never the only
 * signal. Pass the raw API `eventType` string.
 */
export function EventBadge({
  eventType,
  className,
  ...props
}: Omit<BadgeProps, "children"> & { eventType: string }) {
  const statusClass = EVENT_CLASSES[eventType] ?? EVENT_CLASSES[UNKNOWN]!
  const dotClass = EVENT_DOTS[eventType] ?? EVENT_DOTS[UNKNOWN]!

  return (
    <Badge
      data-slot="event-badge"
      variant="outline"
      className={cn("gap-1.5 font-medium", statusClass, className)}
      {...props}
    >
      <StatusDot className={dotClass} />
      {eventTypeLabel(eventType)}
    </Badge>
  )
}
