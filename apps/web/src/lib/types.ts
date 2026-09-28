/**
 * The DropX API's wire contract, as this app consumes it.
 *
 * Hand-written rather than imported from `@dropx/db` so the portal does not
 * depend on a Bun/mysql2 package, and so the transport reality stays visible:
 * the API serialises every `Date` to an ISO string, so timestamps are `string`
 * here, not `Date`.
 */

export type CustomerStatus = "TEMP" | "ACTIVE"

export type ParcelStatus =
  | "CREATED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "AT_HUB"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED"
  | "RETURNED"

export const PARCEL_STATUSES: readonly ParcelStatus[] = [
  "CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "AT_HUB",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
  "RETURNED",
]

export type ParcelType = "DOCUMENT" | "PACKAGE" | "FRAGILE" | "OTHER"

export const PARCEL_TYPES: readonly ParcelType[] = ["DOCUMENT", "PACKAGE", "FRAGILE", "OTHER"]

export type PaymentType = "PREPAID" | "COD"

export const PAYMENT_TYPES: readonly PaymentType[] = ["PREPAID", "COD"]

export type ParcelEventType =
  | "CREATED"
  | "PICKED_UP"
  | "ARRIVED_HUB"
  | "DEPARTED_HUB"
  | "LOADED"
  | "UNLOADED"
  | "ASSIGNED_RIDER"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED"

export type Parcel = {
  id: string
  createdAt: string
  updatedAt: string
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
}

export type ParcelItem = {
  id: string
  createdAt: string
  parcelId: string
  name: string
  description: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

export type ParcelWithItems = Parcel & { items: ParcelItem[] }

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

export type HubRef = {
  code: string
  name: string
  district: string | null
}

export type ParcelEventSummary = {
  eventType: ParcelEventType
  description: string | null
  location: string | null
  createdAt: string
}

export type ParcelTracking = {
  /** Not in the declared `ParcelTracking` projection, but the decoder emits it. */
  parcelId: string
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

export type DeliveryQuote = {
  pricingRuleId: string
  basePrice: number
  weightCharge: number
  codFee: number
  expressFee: number
  total: number
  currency: "BDT"
}

export type OtpChannel = "SMS" | "EMAIL"

export type OtpRequestResult = {
  channel: OtpChannel
  destination: string
  expiresInSeconds: number
  isNewCustomer: boolean
}

export type SessionCustomer = {
  id: string
  name: string
  phone: string
  email: string | null
  status: "ACTIVE"
}

export type TokenPair = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type CustomerSession = TokenPair & {
  customer: SessionCustomer
}

/**
 * `GET /auth/me` for a `web`-audience token always takes the customer branch of
 * the API's `kind` union — a staff or rider token is rejected by the policy
 * layer before the handler runs.
 */
export type SessionMe = {
  kind: "customer"
  audience: "web"
  id: string
  status: CustomerStatus
}

export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "MALFORMED_REQUEST"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "WRONG_AUDIENCE"
  | "CONSENT_REQUIRED"
  | "FORBIDDEN"
  | "MISSING_PERMISSION"
  | "OUT_OF_SCOPE"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "DUPLICATE"
  | "INVALID_STATE_TRANSITION"
  | "ACTIVE_ATTEMPT_EXISTS"
  | "IN_USE"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_NOT_VERIFIED"
  | "CUSTOMER_NOT_ACTIVE"
  | "EMAIL_ALREADY_REGISTERED"
  | "UNREGISTERED_USER"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "DATABASE_ERROR"
  | "NOT_IMPLEMENTED"

export type ApiFieldIssue = {
  field?: string
  message: string
}

export type ApiErrorEnvelope = {
  error: string
  data: null
  status: number
  success: false
  code: ApiErrorCode | string
  details?: ApiFieldIssue[]
}

export type ListQueryParams = {
  page?: number
  limit?: number
  sortBy?: "createdAt" | "updatedAt" | "trackingNumber" | "status" | "weight"
  sort?: "asc" | "desc"
  search?: string
  status?: ParcelStatus
}

export type CreateParcelItemInput = {
  name: string
  description?: string
  quantity: number
  unitPrice: number
}

/**
 * `createOwnParcelSchema`: the staff create input minus `senderCustomerId`,
 * which the API stamps from the session.
 */
export type CreateParcelRequest = {
  receiverCustomerId: string
  receiverName: string
  receiverPhone: string
  originHubId: string
  destinationHubId: string
  originZoneId: string
  destinationZoneId: string
  weight: number
  length?: number
  width?: number
  height?: number
  parcelType: ParcelType
  paymentType: PaymentType
  codAmount: number
  items: CreateParcelItemInput[]
}

export type QuoteRequest = {
  originZoneId: string
  destinationZoneId: string
  weightKg: number
  codAmount: number
  express: boolean
}
