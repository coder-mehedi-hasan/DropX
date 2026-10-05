import type { TransferStatus } from "@dropx/types"

/**
 * The five statuses in words a dispatcher would say out loud. Every transfer
 * status gets a plain-English label — the API's `IN_TRANSIT` is a system word,
 * and a table full of them reads like a database dump rather than a worklist.
 */
export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  PLANNED: "Planned",
  LOADING: "Loading",
  IN_TRANSIT: "In transit",
  ARRIVED: "Arrived",
  CANCELLED: "Cancelled",
}

/**
 * Badge variants, so the worklist can be read at a glance: what is being planned,
 * what is being loaded, what is moving, and what is finished.
 */
export const TRANSFER_STATUS_BADGE: Record<
  TransferStatus,
  "success" | "warning" | "secondary" | "destructive"
> = {
  PLANNED: "secondary",
  LOADING: "warning",
  IN_TRANSIT: "warning",
  ARRIVED: "success",
  CANCELLED: "destructive",
}