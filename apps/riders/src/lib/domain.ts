/**
 * Domain types the API returns, mirrored from `packages/db` so the rider app
 * has no dependency on a database package. `apps/api` decodes rows into exactly
 * these shapes (`Id` is a string, decimals are numbers, and a `Date` reaches the
 * browser as an ISO string).
 */

export const PARCEL_STATUSES = [
  "CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "AT_HUB",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
  "RETURNED",
] as const

export type ParcelStatus = (typeof PARCEL_STATUSES)[number]

export const PARCEL_TYPES = ["DOCUMENT", "PACKAGE", "FRAGILE", "OTHER"] as const

export type ParcelType = (typeof PARCEL_TYPES)[number]

export const PAYMENT_TYPES = ["PREPAID", "COD"] as const

export type PaymentType = (typeof PAYMENT_TYPES)[number]

/**
 * The status of one delivery attempt.
 *
 * Not the same vocabulary as `PARCEL_STATUSES`: a parcel has no `ASSIGNED` row,
 * because assignment belongs to a rider's attempt rather than to the parcel the
 * customer is tracking.
 */
export const DELIVERY_STATUSES = [
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
  "RETURNED",
] as const

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export type Parcel = {
  id: string
  trackingNumber: string
  senderCustomerId: string
  receiverCustomerId: string
  originHubId: string
  destinationHubId: string
  currentHubId: string | null
  destinationZoneId: string
  weight: number
  length: number | null
  width: number | null
  height: number | null
  parcelType: ParcelType
  paymentType: PaymentType
  codAmount: number
  deliveryFee: number
  status: ParcelStatus
  createdAt: string
  updatedAt: string
}

export type ParcelItem = {
  id: string
  parcelId: string
  name: string
  description: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  createdAt: string
}

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

export type PageMeta = {
  totalCount: number
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/** The one list envelope in DropX — never a bare array. */
export type Page<T> = {
  nodes: T[]
  meta: PageMeta
}
