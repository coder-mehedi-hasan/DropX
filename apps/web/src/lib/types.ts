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
  ParcelAddressInput,
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
  ParcelDetail,
  ParcelAddress,
  ParcelAddressInput,
  Page,
  HubRef,
  ParcelEventSummary,
  FeeQuote,
  LocationServiceType,
  PricingLaneWithSlabs,
  PricingSlab,
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
 * The booking form's raw, half-filled state — everything as typed, every field
 * optional, because a draft is saved *before* it is valid. Keys mirror
 * `bookParcelSchema` one-for-one so restoring is a straight `form.reset()`;
 * only the real `CreateParcelRequest` converts strings to numbers.
 */
export type ParcelDraftPayload = {
  step?: number
  receiverName?: string
  receiverPhone?: string
  receiverSecondaryPhone?: string
  deliveryCityId?: string
  deliveryZoneId?: string
  deliveryAreaId?: string
  deliveryAddressLine?: string
  deliveryLatitude?: string
  deliveryLongitude?: string
  pickupCityId?: string
  pickupZoneId?: string
  pickupAreaId?: string
  pickupAddressLine?: string
  pickupLatitude?: string
  pickupLongitude?: string
  weight?: string
  length?: string
  width?: string
  height?: string
  parcelType?: ParcelType
  paymentType?: PaymentType
  codAmount?: string
  items?: Array<{
    name?: string
    description?: string
    quantity?: string
    unitPrice?: string
  }>
}

/** The stored draft: one per customer, replaced on every autosave. */
export type ParcelDraft = {
  id: string
  payload: ParcelDraftPayload
  updatedAt: string
}

/**
 * `createOwnParcelSchema`: the staff create input minus `senderCustomerId`
 * (which the API stamps from the session) and minus both hub ids — a portal
 * booking is addressed, not routed, and the service resolves the hubs from the
 * addresses' map coordinates.
 *
 * Both address ends are the booking cascade's picks — they are stored structered
 * on `parcel_addresses`; the legacy `receiver_address`/`destination_zone_id`
 * columns on `parcels` are no longer written.
 */
export type CreateParcelRequest = {
  /** The receiver is not required to have a DropX account. */
  receiverCustomerId?: string
  receiverName: string
  receiverPhone: string
  receiverSecondaryPhone?: string
  pickupAddress: ParcelAddressInput
  deliveryAddress: ParcelAddressInput
  weight: number
  length?: number
  width?: number
  height?: number
  parcelType: ParcelType
  paymentType: PaymentType
  codAmount: number
  items: CreateParcelItemInput[]
}

/**
 * One saved address in the customer's address book.
 *
 * Structured exactly like one end of a booking — the same city/zone/area cascade
 * plus an address line — so selecting a saved address in the booking form can
 * prefill the picker without a translation layer. The `cityName`/`zoneName`/
 * `areaName` are the location's current names, resolved by the API.
 */
export type CustomerAddress = {
  id: string
  customerId: string
  label: string | null
  cityId: string
  zoneId: string
  areaId: string | null
  cityName: string
  zoneName: string
  areaName: string | null
  addressLine: string
  landmark: string | null
  latitude: number | null
  longitude: number | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type CreateCustomerAddressInput = {
  label?: string | null
  cityId: string
  zoneId: string
  areaId?: string
  addressLine: string
  landmark?: string | null
  latitude?: number
  longitude?: number
  isDefault?: boolean
}

export type UpdateCustomerAddressInput = Partial<CreateCustomerAddressInput>

/**
 * `quoteSchema` on the wire: grams, not kilograms, and the two city/zone pairs
 * the service resolves to a pricing lane.
 */
export type QuoteRequest = {
  pickupCityId: string
  pickupZoneId: string
  deliveryCityId: string
  deliveryZoneId: string
  weightGrams: number
  codAmount: number
}
