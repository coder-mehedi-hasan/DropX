/**
 * Shared domain models and table metadata for DropX.
 *
 * This is the single source of truth for every table and column shape. Frontend
 * apps re-export from here so the API contract and the DB model stay in lockstep.
 * ids are `string` (BIGINT UNSIGNED never loses precision), decimals are
 * `number`, timestamps are `Date` — raw driver rows are converted in repositories.
 */

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

export type Id = string

export type EntityBase = {
  id: Id
}

export type CreatedAt = {
  createdAt: Date
}

export type UpdatedAt = {
  updatedAt: Date
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
  "pricing_rule",
  "vehicle",
  "route",
  "route_stop",
  "rider",
  "parcel",
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

export const ROLE_NAMES = ["ADMIN", "BRANCH_MANAGER", "HUB_OPERATOR", "DISPATCHER", "SUPPORT", "FINANCE", "RIDER"] as const
export type KnownRoleName = (typeof ROLE_NAMES)[number]
export type RoleName = KnownRoleName

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED"

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
    consentAcceptedAt: Nullable<Date>
    activatedAt: Nullable<Date>
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
  recordedAt: Date
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
    receiverCustomerId: Id
    originHubId: Id
    destinationHubId: Id
    currentHubId: Nullable<Id>
    destinationZoneId: Id
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
  createdAt: Date
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
  deliveredAt: Date | null
  events: ParcelEventSummary[]
}

// ---------------------------------------------------------------------------
// Operations (pickups / transfers / deliveries / proofs)
// ---------------------------------------------------------------------------

export const PICKUP_STATUSES = ["REQUESTED", "ASSIGNED", "IN_PROGRESS", "PICKED_UP", "FAILED", "CANCELLED"] as const
export type PickupStatus = (typeof PICKUP_STATUSES)[number]

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

export const TRANSFER_STATUSES = ["PLANNED", "LOADING", "IN_TRANSIT", "ARRIVED", "CANCELLED"] as const
export type TransferStatus = (typeof TRANSFER_STATUSES)[number]

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

export type TransferParcel = {
  transferId: Id
  parcelId: Id
  loadedAt: Nullable<Date>
  unloadedAt: Nullable<Date>
}

export const DELIVERY_STATUSES = ["ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED", "RETURNED"] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const CLOSED_DELIVERY_STATUSES = ["DELIVERED", "FAILED", "CANCELLED", "RETURNED"] as const
export type ClosedDeliveryStatus = (typeof CLOSED_DELIVERY_STATUSES)[number]

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
    paidAt: Nullable<Date>
  }

export const SETTLEMENT_STATUSES = ["PENDING", "PROCESSING", "PAID", "FAILED"] as const
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number]

export type Settlement = EntityBase &
  Timestamped & {
    customerId: Id
    periodStart: string
    periodEnd: string
    totalCod: number
    deliveryCharges: number
    otherCharges: number
    netAmount: number
    status: SettlementStatus
    paidAt: Nullable<Date>
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
    sentAt: Nullable<Date>
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
// Table names
// ---------------------------------------------------------------------------

export const TABLES = {
  roles: "roles",
  branches: "branches",
  hubs: "hubs",
  users: "users",
  userRoles: "user_roles",
  rolePermissions: "role_permissions",
  userHubs: "user_hubs",
  customers: "customers",
  customerAddresses: "customer_addresses",
  zones: "zones",
  pricingRules: "pricing_rules",
  vehicles: "vehicles",
  routes: "routes",
  routeStops: "route_stops",
  riders: "riders",
  riderLocations: "rider_locations",
  parcels: "parcels",
  parcelItems: "parcel_items",
  pickups: "pickups",
  transfers: "transfers",
  transferParcels: "transfer_parcels",
  deliveries: "deliveries",
  deliveryProofs: "delivery_proofs",
  parcelEvents: "parcel_events",
  payments: "payments",
  settlements: "settlements",
  notifications: "notifications",
  supportTickets: "support_tickets",
  auditLogs: "audit_logs",
} as const

export type TableName = (typeof TABLES)[keyof typeof TABLES]

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

export type SortDirection = "asc" | "desc"

export const SORT_DIRECTIONS: readonly SortDirection[] = ["asc", "desc"] as const

export function isSortDirection(value: unknown): value is SortDirection {
  return value === "asc" || value === "desc"
}

export type ListQuery = {
  page?: number | string | null
  limit?: number | string | null
  sortBy?: string | null
  sort?: string | null
  search?: string | null
}

export type ListParams = {
  page: number
  limit: number
  sortBy?: string | undefined
  sort: SortDirection
  search?: string | undefined
  offset: number
}

export type PageMeta = {
  totalCount: number
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export type Page<T> = {
  nodes: T[]
  meta: PageMeta
}

function toPositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed)) return fallback
  const int = Math.trunc(parsed)
  if (int < 1) return fallback
  return Math.min(int, max)
}

export function normalizeListParams(query: ListQuery = {}): ListParams {
  const page = toPositiveInt(query.page, DEFAULT_PAGE, Number.MAX_SAFE_INTEGER)
  const limit = toPositiveInt(query.limit, DEFAULT_LIMIT, MAX_LIMIT)
  const sort = isSortDirection(query.sort) ? query.sort : "desc"
  const search = query.search?.trim()

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    sort,
    sortBy: query.sortBy?.trim() || undefined,
    search: search ? search : undefined,
  }
}

export function buildPage<T>(nodes: T[], totalCount: number, params: ListParams): Page<T> {
  const totalPages = params.limit > 0 ? Math.ceil(totalCount / params.limit) : 0

  return {
    nodes,
    meta: {
      totalCount,
      currentPage: params.page,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1 && totalPages > 0,
    },
  }
}

export function emptyPage<T>(params: ListParams): Page<T> {
  return buildPage<T>([], 0, params)
}

export type PageWindow = {
  limit: number
  offset: number
}

export function toWindow(params: ListParams): PageWindow {
  return { limit: params.limit, offset: params.offset }
}

export type Identifiable = { id: Id }
