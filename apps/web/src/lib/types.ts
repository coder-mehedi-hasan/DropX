/**
 * The DropX API's wire contract, as this app consumes it.
 *
 * The entity shapes, status vocabularies and the list envelope come from
 * `@dropx/types` — the single source of truth shared with the API and the rider
 * app. Web-only shapes (parcel tracking, quoting, OTP/session, errors) are
 * declared below and are the only hand-written types in this file.
 */

import type {
  CustomerStatus,
  ParcelStatus,
  ParcelType,
  PaymentType,
  HubRef,
  ParcelEventSummary,
} from "@dropx/types"

export { PARCEL_STATUSES, PARCEL_TYPES, PAYMENT_TYPES } from "@dropx/types"

export type {
  CustomerStatus,
  ParcelStatus,
  ParcelType,
  PaymentType,
  ParcelEventType,
  Parcel,
  ParcelWithItems,
  Page,
  HubRef,
  ParcelEventSummary,
} from "@dropx/types"

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
  /** The receiver is not required to have a DropX account. */
  receiverCustomerId?: string
  receiverName: string
  receiverPhone: string
  receiverSecondaryPhone?: string
  receiverAddress: string
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
