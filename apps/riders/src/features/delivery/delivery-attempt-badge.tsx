import { Badge, type BadgeProps } from "@dropx/ui"

import type { DeliveryStatus, Job } from "../../lib/domain"
import { DELIVERY_STATUS_LABELS } from "../jobs/jobs.api"

const DELIVERY_STATUS_VARIANTS: Record<DeliveryStatus, NonNullable<BadgeProps["variant"]>> = {
  ASSIGNED: "outline",
  OUT_FOR_DELIVERY: "default",
  DELIVERED: "success",
  FAILED: "destructive",
  CANCELLED: "outline",
  RETURNED: "warning",
}

/**
 * The delivery attempt a rider is acting on.
 *
 * Deliberately a plain `Badge` rather than the `StatusBadge`, which speaks in
 * parcel statuses: the attempt status is the one the rider moves, and printing
 * the attempt number keeps a re-attempt from reading as a first-time failure.
 */
export function DeliveryAttemptBadge({ delivery }: { delivery: Job["delivery"] }) {
  return (
    <Badge variant={DELIVERY_STATUS_VARIANTS[delivery.status]}>
      Attempt {delivery.attemptNo} · {DELIVERY_STATUS_LABELS[delivery.status]}
    </Badge>
  )
}
