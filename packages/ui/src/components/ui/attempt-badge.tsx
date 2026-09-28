import { cn } from "../../lib/cn"
import { Badge, type BadgeProps } from "./badge"

/**
 * Delivery-attempt status labels.
 *
 * Attempt status is not parcel status: a rider may fail attempt 1 and succeed
 * on attempt 2, and the badge must say so. Labels stay short for dense lists.
 */
const ATTEMPT_LABELS: Record<string, string> = {
  ASSIGNED: "Assigned",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
}

const ATTEMPT_CLASSES: Record<string, string> = {
  ASSIGNED: "border-status-created/30 bg-status-created/10",
  OUT_FOR_DELIVERY: "border-status-out-for-delivery/30 bg-status-out-for-delivery/10",
  DELIVERED: "border-status-delivered/30 bg-status-delivered/10",
  FAILED: "border-status-failed/30 bg-status-failed/10",
  CANCELLED: "border-status-created/30 bg-status-created/10",
  RETURNED: "border-status-returned/30 bg-status-returned/10",
}

const ATTEMPT_DOTS: Record<string, string> = {
  ASSIGNED: "bg-status-created",
  OUT_FOR_DELIVERY: "bg-status-out-for-delivery",
  DELIVERED: "bg-status-delivered",
  FAILED: "bg-status-failed",
  CANCELLED: "bg-status-created",
  RETURNED: "bg-status-returned",
}

const UNKNOWN = "ASSIGNED"

function StatusDot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", className)} />
}

export function attemptStatusLabel(status: string): string {
  return ATTEMPT_LABELS[status] ?? status
}

/**
 * AttemptBadge.
 *
 * Dot + ink label for a delivery attempt. Optional `attemptNo` prefixes the
 * label so a retry cannot be read as a first failure.
 */
export function AttemptBadge({
  status,
  attemptNo,
  className,
  ...props
}: Omit<BadgeProps, "children"> & { status: string; attemptNo?: number }) {
  const statusClass = ATTEMPT_CLASSES[status] ?? ATTEMPT_CLASSES[UNKNOWN]!
  const dotClass = ATTEMPT_DOTS[status] ?? ATTEMPT_DOTS[UNKNOWN]!
  const label = attemptStatusLabel(status)

  return (
    <Badge
      data-slot="attempt-badge"
      variant="outline"
      className={cn("gap-1.5 font-medium", statusClass, className)}
      {...props}
    >
      <StatusDot className={dotClass} />
      {attemptNo != null ? `Attempt ${attemptNo} · ${label}` : label}
    </Badge>
  )
}
