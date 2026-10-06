import type { PickupStatus } from "@dropx/types"

/**
 * The six statuses in words a dispatcher would say out loud. Every pickup status
 * gets a plain-English label — the API's `REQUESTED` is a system word, and a
 * table full of them reads like a database dump rather than a worklist.
 */
export const PICKUP_STATUS_LABEL: Record<PickupStatus, string> = {
  REQUESTED: "Awaiting rider",
  ASSIGNED: "Rider assigned",
  IN_PROGRESS: "Out collecting",
  PICKED_UP: "Collected",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
}

/**
 * Badge variants, so the worklist can be read at a glance: what is waiting,
 * what is moving, what is stuck, and what is finished.
 */
export const PICKUP_STATUS_BADGE: Record<
  PickupStatus,
  "success" | "warning" | "secondary" | "destructive"
> = {
  REQUESTED: "warning",
  ASSIGNED: "warning",
  IN_PROGRESS: "warning",
  PICKED_UP: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
}
