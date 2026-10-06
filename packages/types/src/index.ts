/**
 * The wire contract, shared by every app.
 *
 * This is the single source of truth for the shape of every entity DropX exposes.
 * The API imports it to build responses; the admin, rider and customer apps import
 * it to read them. Nothing here is server-only, so nothing here may grow a
 * dependency on the database layer — SQL, table names and pagination arithmetic
 * stay in `apps/api/src/db/models.ts`.
 *
 * It is types and `as const` tuples only, with no build step: apps consume the
 * source directly, the same way they consume `@dropx/ui`.
 *
 * ids are `string` (BIGINT UNSIGNED never loses precision), decimals are `number`,
 * and timestamps are ISO `string`s — the repositories call `.toISOString()`
 * themselves, so the declared type matches the bytes on the wire.
 *
 * Adding a status to a tuple here is therefore a compile error in every app that
 * has not handled it, which is the entire point: the parcel status list used to be
 * written out four times and a fourth app would have silently disagreed.
 */

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

export type Id = string

export type EntityBase = {
  id: Id
}

export type CreatedAt = {
  createdAt: string
}

export type UpdatedAt = {
  updatedAt: string
}

export type Timestamped = CreatedAt & UpdatedAt

export type Nullable<T> = T | null

export const ENTITY_NAMES = [
  "branch",
  "hub",
  "user",
  "role",
  "customer",
  "customer_address",
  "zone",
  "service_city",
  "service_zone",
  "service_area",
  "pricing_rule",
  "pricing_lane",
  "pricing_slab",
  "vehicle",
  "route",
  "route_stop",
  "rider",
  "parcel",
  "parcel_address",
  "parcel_item",
  "pickup",
  "transfer",
  "delivery",
  "delivery_proof",
  "parcel_event",
  "payment",
  "settlement",
  "notification",
  "support_ticket",
] as const

export type EntityName = (typeof ENTITY_NAMES)[number]

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

export type Role = EntityBase &
  Timestamped & {
    name: RoleName | (string & {})
    description: Nullable<string>
  }

export const ROLE_NAMES = [
  "ADMIN",
  "BRANCH_MANAGER",
  "HUB_OPERATOR",
  "DISPATCHER",
  "SUPPORT",
  "FINANCE",
  "RIDER",
] as const
export type KnownRoleName = (typeof ROLE_NAMES)[number]
export type RoleName = KnownRoleName

export const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export type User = EntityBase &
  Timestamped & {
    branchId: Nullable<Id>
    name: string
    email: string
    phone: Nullable<string>
    passwordHash: string
    status: UserStatus
  }

export type UserRole = {
  userId: Id
  roleId: Id
}

export type RolePermission = {
  roleId: Id
  permissionKey: string
}

export type UserHub = {
  userId: Id
  hubId: Id
}

export type UserWithRoles = User & {
  roles: Role[]
  permissions: string[]
  hubIds: Id[]
}

// ---------------------------------------------------------------------------
// Org (branches / hubs)
// ---------------------------------------------------------------------------

export const BRANCH_STATUSES = ["ACTIVE", "INACTIVE"] as const
export type BranchStatus = (typeof BRANCH_STATUSES)[number]

export type Branch = EntityBase &
  Timestamped & {
    name: string
    code: string
    phone: Nullable<string>
    address: Nullable<string>
    city: Nullable<string>
    district: Nullable<string>
    latitude: Nullable<number>
    longitude: Nullable<number>
    status: BranchStatus
  }

export const HUB_TYPES = ["ORIGIN", "SORTING", "TRANSIT", "DESTINATION"] as const
export type HubType = (typeof HUB_TYPES)[number]

export const HUB_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE"] as const
export type HubStatus = (typeof HUB_STATUSES)[number]

export type Hub = EntityBase &
  Timestamped & {
    branchId: Id
    name: string
    code: string
    type: HubType
    address: Nullable<string>
    district: Nullable<string>
    latitude: Nullable<number>
    longitude: Nullable<number>
    capacity: Nullable<number>
    status: HubStatus
  }

export type HubWithBranch = Hub & {
  branchName: string
  branchCode: string
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const CUSTOMER_TYPES = ["INDIVIDUAL", "BUSINESS"] as const
export type CustomerType = (typeof CUSTOMER_TYPES)[number]

export const CUSTOMER_STATUSES = ["TEMP", "ACTIVE"] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export type Customer = EntityBase &
  Timestamped & {
    name: string
    phone: string
    email: Nullable<string>
    type: CustomerType
    status: CustomerStatus
    consentAcceptedAt: Nullable<string>
    activatedAt: Nullable<string>
  }

export type CustomerAddress = EntityBase &
  Timestamped & {
    customerId: Id
    label: Nullable<string>
    addressLine: string
    city: Nullable<string>
    district: Nullable<string>
    postalCode: Nullable<string>
    latitude: Nullable<number>
    longitude: Nullable<number>
    isDefault: boolean
  }

export type CustomerWithAddresses = Customer & {
  addresses: CustomerAddress[]
}

// ---------------------------------------------------------------------------
// Network (zones / routes / pricing)
// ---------------------------------------------------------------------------

export const RECORD_STATUSES = ["ACTIVE", "INACTIVE"] as const
export type RecordStatus = (typeof RECORD_STATUSES)[number]

/** Alias kept for readability at the zones call sites, where the bare name
 *  `RecordStatus` says nothing about which table it belongs to. */
export const ZONE_STATUSES = RECORD_STATUSES
export type ZoneStatus = RecordStatus

export type Zone = EntityBase &
  Timestamped & {
    name: string
    code: string
    description: Nullable<string>
    status: RecordStatus
  }

export type PricingRule = EntityBase &
  Timestamped & {
    name: string
    originZoneId: Id
    destinationZoneId: Id
    minWeight: number
    maxWeight: Nullable<number>
    basePrice: number
    pricePerKg: number
    codPercentage: number
    codFixedFee: number
    expressFee: number
    status: RecordStatus
  }

// ---------------------------------------------------------------------------
// Service locations (city -> zone -> area)
// ---------------------------------------------------------------------------

/**
 * What a city is, for pricing. `ISD`/`SUBURB`/`OSD` is half of the pricing-lane
 * key, so it is carried on the city rather than chosen at quote time.
 *
 * Deactivated locations stay in the table and keep their foreign keys — a
 * historical parcel must never lose the place it was sent to — so every
 * customer-facing read filters on `ACTIVE` rather than relying on absence.
 */
export const LOCATION_SERVICE_TYPES = ["ISD", "SUBURB", "OSD"] as const
export type LocationServiceType = (typeof LOCATION_SERVICE_TYPES)[number]

export type ServiceCity = EntityBase &
  Timestamped & {
    name: string
    code: string
    serviceType: LocationServiceType
    status: RecordStatus
  }

export type ServiceZone = EntityBase &
  Timestamped & {
    cityId: Id
    name: string
    code: string
    status: RecordStatus
  }

export type ServiceArea = EntityBase &
  Timestamped & {
    zoneId: Id
    name: string
    code: string
    status: RecordStatus
  }

// ---------------------------------------------------------------------------
// Pricing lanes & slabs
// ---------------------------------------------------------------------------

/**
 * The two ends of a pricing lane.
 *
 * `ISD_ON_DEMAND` / `SAME_CITY_ON_DEMAND` are the same-city express pair; every
 * other value is a `LocationServiceType`, with `SAME_CITY` and
 * `DIFFERENT_CITY` standing in for "the delivery city's type, but somewhere
 * else" so the matrix does not need a row per (pickup type x delivery type x
 * same-city) combination.
 */
export const PRICING_PICKUP_TYPES = ["ISD", "SUBURB", "OSD", "ISD_ON_DEMAND"] as const
export type PricingPickupType = (typeof PRICING_PICKUP_TYPES)[number]

export const PRICING_DELIVERY_TYPES = [
  "ISD",
  "SUBURB",
  "OSD",
  "SAME_CITY",
  "DIFFERENT_CITY",
  "SAME_CITY_ON_DEMAND",
] as const
export type PricingDeliveryType = (typeof PRICING_DELIVERY_TYPES)[number]

export type PricingLane = EntityBase &
  Timestamped & {
    pickupType: PricingPickupType
    deliveryType: PricingDeliveryType
    sameCity: boolean
    status: RecordStatus
  }

/**
 * One weight band of one lane. Grams, not kilograms: the bands are 0-200g,
 * 201-500g, 501g-1kg and 1kg-2kg, and a kilogram column cannot express the
 * first two. Slabs of a lane never overlap — the service rejects an insert or
 * an edit whose range intersects an existing one.
 */
export type PricingSlab = EntityBase &
  Timestamped & {
    pricingLaneId: Id
    minWeightGrams: number
    maxWeightGrams: number
    baseFee: number
    /** Per whole kg above `maxWeightGrams`, and only the top slab's ever applies. */
    extraKgFee: number
    codPercentage: number
    codFixedFee: number
    status: RecordStatus
  }

export type PricingLaneWithSlabs = PricingLane & {
  slabs: PricingSlab[]
}

/**
 * The server's fee breakdown. The client never computes a price; it renders
 * these four numbers and the lane/slab that produced them.
 */
export type FeeQuote = {
  baseFee: number
  codFee: number
  extraWeightFee: number
  total: number
  currency: "BDT"
  lane: {
    pickupType: PricingPickupType
    deliveryType: PricingDeliveryType
    sameCity: boolean
  }
  slab: {
    minWeightGrams: number
    maxWeightGrams: number
  }
}

export type Route = EntityBase &
  Timestamped & {
    name: string
    code: string
    originHubId: Id
    destinationHubId: Id
    distanceKm: Nullable<number>
    estimatedMinutes: Nullable<number>
    status: RecordStatus
  }

export type RouteStop = EntityBase & {
  routeId: Id
  hubId: Id
  sequenceNo: number
  estimatedArrivalMinutes: Nullable<number>
}

export type RouteWithStops = Route & {
  stops: RouteStop[]
}

// ---------------------------------------------------------------------------
// Fleet (vehicles / riders)
// ---------------------------------------------------------------------------

export const VEHICLE_TYPES = ["BIKE", "VAN", "TRUCK", "COVERED_VAN"] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]

export const VEHICLE_STATUSES = ["AVAILABLE", "IN_USE", "MAINTENANCE", "INACTIVE"] as const
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]

export type Vehicle = EntityBase &
  Timestamped & {
    registrationNumber: string
    type: VehicleType
    capacityKg: number
    status: VehicleStatus
  }

export const COMPENSATION_TYPES = ["SALARIED", "CONTRACTUAL", "COMMISSION", "MIXED"] as const
export type CompensationType = (typeof COMPENSATION_TYPES)[number]

export const RIDER_STATUSES = ["AVAILABLE", "BUSY", "OFFLINE", "SUSPENDED"] as const
export type RiderStatus = (typeof RIDER_STATUSES)[number]

export type Rider = EntityBase &
  Timestamped & {
    userId: Id
    hubId: Id
    employeeCode: string
    licenseNumber: Nullable<string>
    compensationType: CompensationType
    status: RiderStatus
  }

export type RiderLocation = EntityBase & {
  riderId: Id
  latitude: number
  longitude: number
  recordedAt: string
}

export type RiderWithUser = Rider & {
  user: {
    id: Id
    name: string
    email: string
    phone: Nullable<string>
    branchId: Nullable<Id>
  }
}

// ---------------------------------------------------------------------------
// Parcels
// ---------------------------------------------------------------------------

export const PARCEL_TYPES = ["DOCUMENT", "PACKAGE", "FRAGILE", "OTHER"] as const
export type ParcelType = (typeof PARCEL_TYPES)[number]

export const PAYMENT_TYPES = ["PREPAID", "COD"] as const
export type PaymentType = (typeof PAYMENT_TYPES)[number]

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
}

export function canTransitionParcel(from: ParcelStatus, to: ParcelStatus): boolean {
  return PARCEL_TRANSITIONS[from].includes(to)
}

export type Parcel = EntityBase &
  Timestamped & {
    trackingNumber: string
    senderCustomerId: Id
    /** The receiver is not required to have an account. */
    receiverCustomerId: Nullable<Id>
    receiverName: string
    receiverPhone: string
    receiverSecondaryPhone: Nullable<string>
    receiverAddress: Nullable<string>
    originHubId: Id
    destinationHubId: Id
    currentHubId: Nullable<Id>
    /**
     * Legacy pricing anchor from the flat `zones` model. New bookings quote from
     * `addresses` and the lane matrix, so this is `null` for anything booked
     * after the migration; older rows keep the zone they were quoted against.
     */
    destinationZoneId: Nullable<Id>
    weight: number
    length: Nullable<number>
    width: Nullable<number>
    height: Nullable<number>
    parcelType: ParcelType
    paymentType: PaymentType
    codAmount: number
    deliveryFee: number
    status: ParcelStatus
  }

export type ParcelItem = EntityBase &
  CreatedAt & {
    parcelId: Id
    name: string
    description: Nullable<string>
    quantity: number
    unitPrice: number
    totalPrice: number
  }

export type ParcelWithItems = Parcel & {
  items: ParcelItem[]
}

export const PARCEL_ADDRESS_TYPES = ["PICKUP", "DELIVERY"] as const
export type ParcelAddressType = (typeof PARCEL_ADDRESS_TYPES)[number]

/**
 * One end of a parcel's structured address, stored as a row rather than as
 * columns on `parcels` so the two ends cannot drift apart and so a parcel keeps
 * both after the hierarchy is renamed underneath it.
 *
 * The `cityName`/`zoneName`/`areaName` fields are snapshots written at booking
 * time. They are what a historical read uses: joining back to `service_*` would
 * silently rewrite the past whenever an administrator renames a zone.
 */
export type ParcelAddress = EntityBase &
  Timestamped & {
    parcelId: Id
    type: ParcelAddressType
    cityId: Id
    zoneId: Id
    areaId: Nullable<Id>
    cityName: string
    zoneName: string
    areaName: Nullable<string>
    addressLine: string
    landmark: Nullable<string>
    latitude: Nullable<number>
    longitude: Nullable<number>
  }

/** What a booking sends for each end. The server resolves ids to snapshots. */
export type ParcelAddressInput = {
  cityId: Id
  zoneId: Id
  areaId?: Id
  addressLine: string
  landmark?: string
  latitude?: number
  longitude?: number
}

/** The parcel detail read: the row, its items, and both structured addresses. */
export type ParcelDetail = ParcelWithItems & {
  addresses: ParcelAddress[]
}

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
] as const
export type ParcelEventType = (typeof PARCEL_EVENT_TYPES)[number]

export type ParcelEvent = EntityBase &
  CreatedAt & {
    parcelId: Id
    eventType: ParcelEventType
    hubId: Nullable<Id>
    userId: Nullable<Id>
    riderId: Nullable<Id>
    description: Nullable<string>
    latitude: Nullable<number>
    longitude: Nullable<number>
  }

export type ParcelEventWithActor = ParcelEvent & {
  hubName: Nullable<string>
  riderName: Nullable<string>
}

export type HubRef = {
  code: string
  name: string
  district: Nullable<string>
}

export type ParcelEventSummary = {
  eventType: ParcelEventType
  description: Nullable<string>
  location: Nullable<string>
  createdAt: string
}

export type ParcelTracking = {
  trackingNumber: string
  status: ParcelStatus
  parcelType: ParcelType
  paymentType: PaymentType
  codAmount: number
  weight: number
  originHub: HubRef
  destinationHub: HubRef
  currentHub: HubRef | null
  deliveredAt: string | null
  events: ParcelEventSummary[]
}

// ---------------------------------------------------------------------------
// Operations (pickups / transfers / deliveries / proofs)
// ---------------------------------------------------------------------------

export const PICKUP_STATUSES = [
  "REQUESTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "PICKED_UP",
  "FAILED",
  "CANCELLED",
] as const
export type PickupStatus = (typeof PICKUP_STATUSES)[number]

/**
 * The pickup lifecycle, in the same shape and for the same reason as
 * `PARCEL_TRANSITIONS`: the API enforces it, and the admin's status control needs
 * to know which options to offer. One table means the dropdown cannot offer a move
 * the server will reject, and adding a status without adding it here is a type
 * error rather than a silently stuck transition.
 *
 * `PICKED_UP`, `CANCELLED` are terminal. `FAILED` is not — a failed collection is
 * retried by moving it back to `ASSIGNED` with a different rider, or given up on
 * with `CANCELLED`.
 */
export const PICKUP_TRANSITIONS: Readonly<Record<PickupStatus, readonly PickupStatus[]>> = {
  REQUESTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "FAILED", "CANCELLED"],
  IN_PROGRESS: ["PICKED_UP", "FAILED", "CANCELLED"],
  PICKED_UP: [],
  FAILED: ["ASSIGNED", "CANCELLED"],
  CANCELLED: [],
}

export function canTransitionPickup(from: PickupStatus, to: PickupStatus): boolean {
  return PICKUP_TRANSITIONS[from].includes(to)
}

export type Pickup = EntityBase &
  Timestamped & {
    parcelId: Id
    requestedBy: Nullable<Id>
    assignedRiderId: Nullable<Id>
    pickupAddress: string
    scheduledAt: Nullable<string>
    pickedUpAt: Nullable<string>
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
 * The transfer lifecycle, shaped like `PARCEL_TRANSITIONS` and `PICKUP_TRANSITIONS`
 * for the same reason: the API enforces it and the admin's status control offers
 * exactly these moves.
 *
 * Two edges carry more weight than they look:
 *
 * - **`LOADING → PLANNED`** exists so a transfer that was never filled can go back
 *   to being a draft, with its manifest intact, instead of being cancelled.
 * - **`IN_TRANSIT → ARRIVED` is the only way out.** The manifest is sealed from
 *   departure, so a truck in transit can only be arrived or… nothing. There is no
 *   "cancel a transfer that already left", because the parcels are on a vehicle
 *   this system does not track.
 */
export const TRANSFER_TRANSITIONS: Readonly<Record<TransferStatus, readonly TransferStatus[]>> = {
  PLANNED: ["LOADING", "CANCELLED"],
  LOADING: ["IN_TRANSIT", "PLANNED", "CANCELLED"],
  IN_TRANSIT: ["ARRIVED"],
  ARRIVED: [],
  CANCELLED: [],
}

export function canTransitionTransfer(from: TransferStatus, to: TransferStatus): boolean {
  return TRANSFER_TRANSITIONS[from].includes(to)
}

export type Transfer = EntityBase &
  Timestamped & {
    transferNumber: string
    fromHubId: Id
    toHubId: Id
    routeId: Nullable<Id>
    vehicleId: Nullable<Id>
    driverId: Nullable<Id>
    status: TransferStatus
    departedAt: Nullable<string>
    arrivedAt: Nullable<string>
  }

export type TransferParcel = {
  transferId: Id
  parcelId: Id
  loadedAt: Nullable<string>
  unloadedAt: Nullable<string>
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

export const CLOSED_DELIVERY_STATUSES = ["DELIVERED", "FAILED", "CANCELLED", "RETURNED"] as const
export type ClosedDeliveryStatus = (typeof CLOSED_DELIVERY_STATUSES)[number]

/**
 * The delivery attempt lifecycle, in the same shape and for the same reason as
 * `PARCEL_TRANSITIONS` and `PICKUP_TRANSITIONS`: the API enforces it, and the
 * admin's status control offers exactly these moves.
 *
 * `ASSIGNED` is the only state a rider is set in by dispatch; the rider's own
 * outcomes (`DELIVERED`, `FAILED`, `RETURNED`) close the attempt through the
 * jobs endpoint, and a failed or cancelled attempt is retried as a **new**
 * `deliveries` row with the next `attempt_no`, never by reopening. So every
 * closed status maps to an empty transition list here — closure is final, and
 * the retry is a fresh row.
 */
export const DELIVERY_TRANSITIONS: Readonly<Record<DeliveryStatus, readonly DeliveryStatus[]>> = {
  ASSIGNED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED", "CANCELLED", "RETURNED"],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
  RETURNED: [],
}

export function canTransitionDelivery(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to)
}

export type Delivery = EntityBase &
  Timestamped & {
    parcelId: Id
    hubId: Id
    riderId: Id
    attemptNo: number
    deliveryAddress: string
    assignedAt: Nullable<string>
    outForDeliveryAt: Nullable<string>
    deliveredAt: Nullable<string>
    status: DeliveryStatus
    failureReason: Nullable<string>
    recipientName: Nullable<string>
    recipientPhone: Nullable<string>
  }

export const PROOF_TYPES = ["SIGNATURE", "PHOTO", "OTP", "IDENTITY"] as const
export type ProofType = (typeof PROOF_TYPES)[number]

// `Timestamped` is wrong for proofs: the table has no `updated_at` column — a
// proof is written once and only `verified_at` can change. Mirroring
// `parcel_items`' `EntityBase & CreatedAt` keeps the wire type honest.
export type DeliveryProof = EntityBase &
  CreatedAt & {
    deliveryId: Id
    type: ProofType
    value: Nullable<string>
    fileUrl: Nullable<string>
    verifiedAt: Nullable<string>
  }

/**
 * One unit of work for a rider: the attempt they are acting on, plus the parcel
 * it moves. This is the `/rider/jobs` projection, not a stored row.
 *
 * `delivery.status` and `parcel.status` are deliberately both present and
 * deliberately different — the attempt is the rider's leg and only the rider
 * moves it, while the parcel status is what the customer is told and the API
 * moves it in the same transaction — so a screen that shows one of them as "the"
 * status is misleading.
 */
/**
 * One end of the parcel a job moves, read from `parcel_addresses`.
 *
 * Every field is nullable because a job on a parcel booked before the
 * structured-address migration has no row to read: the flat `delivery.address`
 * snapshot is then the only address there is. Field names mirror the
 * `parcel_addresses` columns so this projection stays a rename.
 */
export type JobAddress = {
  addressLine: Nullable<string>
  areaName: Nullable<string>
  zoneName: Nullable<string>
  cityName: Nullable<string>
  landmark: Nullable<string>
}

export type Job = {
  /**
   * The rider's leg of the work. Spelled out rather than picked from `Delivery`,
   * because the projection renames `deliveryAddress` to `address` — the parcel is
   * the thing being delivered, so the address is the address. `address` is the
   * snapshot dispatch planned against and is always present; the structured
   * fields below back it with the area/city/landmark the rider reads at the door
   * and are null on parcels that predate the migration.
   */
  delivery: {
    id: Id
    attemptNo: number
    status: DeliveryStatus
    address: string
    addressLine: Nullable<string>
    areaName: Nullable<string>
    zoneName: Nullable<string>
    cityName: Nullable<string>
    landmark: Nullable<string>
    failureReason: Nullable<string>
    recipientName: Nullable<string>
    recipientPhone: Nullable<string>
    outForDeliveryAt: Nullable<string>
    deliveredAt: Nullable<string>
  }
  /**
   * The structured pickup address, present for return or failed-delivery work
   * when the parcel was booked structured.
   */
  pickup: JobAddress
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

// ---------------------------------------------------------------------------
// Money (payments / settlements)
// ---------------------------------------------------------------------------

export const PAYMENT_KINDS = ["DELIVERY_FEE", "COD", "REFUND", "OTHER"] as const
export type PaymentKind = (typeof PAYMENT_KINDS)[number]

export const PAYMENT_METHODS = ["CASH", "BKASH", "NAGAD", "CARD", "BANK", "ONLINE"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_STATES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const
export type PaymentState = (typeof PAYMENT_STATES)[number]

export type Payment = EntityBase &
  CreatedAt & {
    parcelId: Id
    type: PaymentKind
    amount: number
    method: PaymentMethod
    status: PaymentState
    paidAt: Nullable<string>
  }

/**
 * Valid payment state transitions. `PENDING` is a digital-payment construct:
 * batch 4 only ever writes `COD`/`REFUND` rows straight to `PAID`, and nothing
 * in that batch creates a `PENDING` row, so the transition is declared here as
 * the contract and exercised the moment an online path exists.
 */
export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentState, readonly PaymentState[]>> = {
  PENDING: ["PAID", "FAILED"],
  PAID: ["REFUNDED"],
  FAILED: [],
  REFUNDED: [],
}

export function canTransitionPayment(from: PaymentState, to: PaymentState): boolean {
  return (PAYMENT_TRANSITIONS[from] as readonly string[]).includes(to)
}

/**
 * Valid settlement status transitions: `PENDING → PROCESSING → PAID` is the
 * happy path a `paid_at` stamp rides on, `FAILED` is reachable from either
 * open status (a payout bounced), and `FAILED → PENDING` re-arms it for a
 * retry. `PAID` is terminal — a settled period is never reopened, the
 * correction is a new period's settlement.
 */
export const SETTLEMENT_TRANSITIONS: Readonly<
  Record<SettlementStatus, readonly SettlementStatus[]>
> = {
  PENDING: ["PROCESSING", "FAILED"],
  PROCESSING: ["PAID", "FAILED"],
  PAID: [],
  FAILED: ["PENDING"],
}

export function canTransitionSettlement(from: SettlementStatus, to: SettlementStatus): boolean {
  return (SETTLEMENT_TRANSITIONS[from] as readonly string[]).includes(to)
}

export const SETTLEMENT_STATUSES = ["PENDING", "PROCESSING", "PAID", "FAILED"] as const
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number]

/**
 * The settlement row is write-once then status-transitioned, like `Payment`,
 * so `CreatedAt` — the table has no `updated_at` column.
 */
export type Settlement = EntityBase &
  CreatedAt & {
    customerId: Id
    periodStart: string
    periodEnd: string
    totalCod: number
    deliveryCharges: number
    otherCharges: number
    netAmount: number
    status: SettlementStatus
    paidAt: Nullable<string>
  }

export type SettlementPeriod = {
  periodStart: string
  periodEnd: string
}

// ---------------------------------------------------------------------------
// Misc (notifications / support / audit)
// ---------------------------------------------------------------------------

export const NOTIFICATION_CHANNELS = ["SMS", "EMAIL", "PUSH"] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const NOTIFICATION_STATUSES = ["PENDING", "SENT", "FAILED"] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export type Notification = EntityBase &
  CreatedAt & {
    userId: Nullable<Id>
    customerId: Nullable<Id>
    parcelId: Nullable<Id>
    channel: NotificationChannel
    eventType: string
    recipient: string
    message: string
    status: NotificationStatus
    sentAt: Nullable<string>
  }

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export type SupportTicket = EntityBase &
  Timestamped & {
    customerId: Id
    parcelId: Nullable<Id>
    assignedTo: Nullable<Id>
    subject: string
    description: string
    priority: TicketPriority
    status: TicketStatus
  }

export type SupportTicketDetail = SupportTicket & {
  customerName: string
  customerPhone: string
  assigneeName: Nullable<string>
}

export type AuditLog = EntityBase &
  CreatedAt & {
    userId: Nullable<Id>
    action: string
    entityType: EntityName | (string & {})
    entityId: Nullable<Id>
    oldData: Nullable<unknown>
    newData: Nullable<unknown>
    ipAddress: Nullable<string>
  }

// ---------------------------------------------------------------------------
// List contract
// ---------------------------------------------------------------------------

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
