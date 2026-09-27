import type { Id } from "../port/database";
import type { CreatedAt, EntityBase, Nullable, Timestamped } from "./base";

export const PARCEL_TYPES = ["DOCUMENT", "PACKAGE", "FRAGILE", "OTHER"] as const;
export type ParcelType = (typeof PARCEL_TYPES)[number];

export const PAYMENT_TYPES = ["PREPAID", "COD"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

/** The lifecycle. See the state diagram in `docs/overview.md`. */
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
] as const;
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

/** Forward edges of the lifecycle; anything else needs an explicit override. */
export const PARCEL_TRANSITIONS: Readonly<Record<ParcelStatus, readonly ParcelStatus[]>> = {
  CREATED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "AT_HUB", "FAILED", "CANCELLED"],
  IN_TRANSIT: ["AT_HUB", "OUT_FOR_DELIVERY", "FAILED", "RETURNED"],
  AT_HUB: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "FAILED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED", "RETURNED"],
  DELIVERED: [],
  FAILED: ["OUT_FOR_DELIVERY", "RETURNED", "CANCELLED"],
  CANCELLED: [],
  RETURNED: [],
};

export function canTransitionParcel(from: ParcelStatus, to: ParcelStatus): boolean {
  return PARCEL_TRANSITIONS[from].includes(to);
}

export type Parcel = EntityBase & Timestamped & {
  trackingNumber: string;
  senderCustomerId: Id;
  receiverCustomerId: Id;
  originHubId: Id;
  destinationHubId: Id;
  currentHubId: Nullable<Id>;
  /** Required — fee calculation is anchored on the destination zone. */
  destinationZoneId: Id;
  weight: number;
  length: Nullable<number>;
  width: Nullable<number>;
  height: Nullable<number>;
  parcelType: ParcelType;
  paymentType: PaymentType;
  codAmount: number;
  deliveryFee: number;
  status: ParcelStatus;
};

export type ParcelItem = EntityBase & CreatedAt & {
  parcelId: Id;
  name: string;
  description: Nullable<string>;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type ParcelWithItems = Parcel & {
  items: ParcelItem[];
};

export const PARCEL_EVENT_TYPES = [
  "CREATED",
  "PICKED_UP",
  "ARRIVED_HUB",
  "DEPARTED_HUB",
  "LOADED",
  "UNLOADED",
  "ASSIGNED_RIDER",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RETURNED",
] as const;
export type ParcelEventType = (typeof PARCEL_EVENT_TYPES)[number];

/** Append-only tracking history. Written after the parcel write commits. */
export type ParcelEvent = EntityBase & CreatedAt & {
  parcelId: Id;
  eventType: ParcelEventType;
  hubId: Nullable<Id>;
  userId: Nullable<Id>;
  riderId: Nullable<Id>;
  description: Nullable<string>;
  latitude: Nullable<number>;
  longitude: Nullable<number>;
};

export type ParcelEventWithActor = ParcelEvent & {
  hubName: Nullable<string>;
  riderName: Nullable<string>;
};

/**
 * Public tracking projection. Deliberately excludes sender/receiver identity —
 * public tracking is by tracking number only, and must not leak unrelated PII.
 */
export type ParcelTracking = {
  trackingNumber: string;
  status: ParcelStatus;
  parcelType: ParcelType;
  paymentType: PaymentType;
  codAmount: number;
  weight: number;
  originHub: HubRef;
  destinationHub: HubRef;
  currentHub: HubRef | null;
  deliveredAt: Date | null;
  events: ParcelEventSummary[];
};

export type HubRef = {
  code: string;
  name: string;
  city: Nullable<string>;
};

export type ParcelEventSummary = {
  eventType: ParcelEventType;
  description: Nullable<string>;
  location: Nullable<string>;
  createdAt: Date;
};
