import type { Id } from "../port/database"
import type { EntityBase, Nullable, Timestamped } from "./base"

export const PICKUP_STATUSES = [
  "REQUESTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "PICKED_UP",
  "FAILED",
  "CANCELLED",
] as const
export type PickupStatus = (typeof PICKUP_STATUSES)[number]

/** `requestedBy` is the staff user who raised it; null for customer-requested pickups. */
export type Pickup = EntityBase &
  Timestamped & {
    parcelId: Id
    requestedBy: Nullable<Id>
    assignedRiderId: Nullable<Id>
    pickupAddress: string
    scheduledAt: Nullable<Date>
    pickedUpAt: Nullable<Date>
    status: PickupStatus
    failureReason: Nullable<string>
  }

export const TRANSFER_STATUSES = [
  "PLANNED",
  "LOADING",
  "IN_TRANSIT",
  "ARRIVED",
  "CANCELLED",
] as const
export type TransferStatus = (typeof TRANSFER_STATUSES)[number]

/**
 * `driverId` points at `users`, **not** `riders` — transfer drivers are staff.
 * See `docs/overview.md` rule 9.
 */
export type Transfer = EntityBase &
  Timestamped & {
    transferNumber: string
    fromHubId: Id
    toHubId: Id
    routeId: Nullable<Id>
    vehicleId: Nullable<Id>
    driverId: Nullable<Id>
    status: TransferStatus
    departedAt: Nullable<Date>
    arrivedAt: Nullable<Date>
  }

/** Join row for loading/unloading parcels onto a transfer. */
export type TransferParcel = {
  transferId: Id
  parcelId: Id
  loadedAt: Nullable<Date>
  unloadedAt: Nullable<Date>
}

export const DELIVERY_STATUSES = [
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
  "RETURNED",
] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

/** Terminal-ish states; only these may be followed by a new `attemptNo`. */
export const CLOSED_DELIVERY_STATUSES = ["DELIVERED", "FAILED", "CANCELLED", "RETURNED"] as const
export type ClosedDeliveryStatus = (typeof CLOSED_DELIVERY_STATUSES)[number]

/**
 * One row per delivery attempt. Retries insert a new row with the next
 * `attemptNo`; `(parcel_id, attempt_no)` is unique and only one attempt may be
 * open at a time — the API enforces that, not the schema.
 */
export type Delivery = EntityBase &
  Timestamped & {
    parcelId: Id
    hubId: Id
    riderId: Id
    attemptNo: number
    deliveryAddress: string
    assignedAt: Nullable<Date>
    outForDeliveryAt: Nullable<Date>
    deliveredAt: Nullable<Date>
    status: DeliveryStatus
    failureReason: Nullable<string>
    recipientName: Nullable<string>
    recipientPhone: Nullable<string>
  }

export const PROOF_TYPES = ["SIGNATURE", "PHOTO", "OTP", "IDENTITY"] as const
export type ProofType = (typeof PROOF_TYPES)[number]

export type DeliveryProof = EntityBase &
  Timestamped & {
    deliveryId: Id
    type: ProofType
    value: Nullable<string>
    fileUrl: Nullable<string>
    verifiedAt: Nullable<Date>
  }
