/**
 * Domain types the API returns. The shared shapes (statuses, entities,
 * pagination) come from `@dropx/types` — the single source of truth the API
 * writes to and every other app reads from, so the parcel status list can be
 * extended in one place and break the build everywhere that has not handled it.
 * Rider-only shapes (Job, JobDetail) are declared below.
 */

import type {
  Parcel,
  ParcelItem,
  DeliveryStatus,
} from "@dropx/types"


export type { DeliveryStatus, PageMeta, Page } from "@dropx/types"

/**
 * One unit of work for a rider: the attempt they are acting on, plus the parcel
 * it moves.
 *
 * `delivery.status` and `parcel.status` are deliberately both present and
 * deliberately different — the attempt is the rider's leg and only the rider
 * moves it, while the parcel status is what the customer is told and the API
 * moves it in the same transaction — so a screen that shows one of them as "the"
 * status is misleading.
 */
export type Job = {
  delivery: {
    id: string
    attemptNo: number
    status: DeliveryStatus
    address: string
    failureReason: string | null
    recipientName: string | null
    recipientPhone: string | null
    outForDeliveryAt: string | null
    deliveredAt: string | null
  }
  /**
   * A narrow slice of the parcel projection, so a rider job carries no hub, zone
   * or customer id that a rider has no use for on the road.
   */
  parcel: Pick<
    Parcel,
    "id" | "trackingNumber" | "status" | "weight" | "codAmount" | "paymentType" | "createdAt"
  >
}

/** The read and status-update responses, which add the declared contents. */
export type JobDetail = Job & {
  items: ParcelItem[]
}

