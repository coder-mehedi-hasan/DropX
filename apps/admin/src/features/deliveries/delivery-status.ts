import type { DeliveryStatus } from "@dropx/types"

/**
 * The six attempt statuses in words a dispatcher would say out loud. Same
 * convention as `PICKUP_STATUS_LABEL` — the API's `OUT_FOR_DELIVERY` is a
 * system word, and a table full of them reads like a database dump.
 */
export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  ASSIGNED: "Rider assigned",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
}

export const DELIVERY_STATUS_BADGE: Record<
  DeliveryStatus,
  "success" | "warning" | "secondary" | "destructive"
> = {
  ASSIGNED: "warning",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
  RETURNED: "secondary",
}
