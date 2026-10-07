import { apiRequest } from "@/lib/api-client"
import type {
  CreateCustomerAddressInput,
  CreateParcelRequest,
  CustomerAddress,
  CustomerSession,
  FeeQuote,
  ListQueryParams,
  OtpChannel,
  OtpRequestResult,
  Page,
  Parcel,
  ParcelDetail,
  ParcelTracking,
  PricingLaneWithSlabs,
  QuoteRequest,
  SessionMe,
  TokenPair,
  UpdateCustomerAddressInput,
} from "@/lib/types"

/**
 * Every call the customer portal is allowed to make.
 *
 * The staff `/admin/parcels` collection is deliberately absent: a customer token
 * is refused by the API's policy layer, so the portal only ever speaks to
 * `/customer/parcels*`, plus the public `/tracking/:trackingNumber` and the
 * `web`-audience auth and pricing routes. The separation is a mount and an
 * `audience`, not a path convention the client has to remember.
 */

export const authApi = {
  requestOtp(identifier: string, acceptSignup = false): Promise<OtpRequestResult> {
    return apiRequest<OtpRequestResult>("/auth/otp/request", {
      method: "POST",
      auth: false,
      body: { identifier, consent: true, acceptSignup },
    })
  },

  verifyOtp(identifier: string, code: string): Promise<CustomerSession> {
    return apiRequest<CustomerSession>("/auth/otp/verify", {
      method: "POST",
      auth: false,
      body: { identifier, code },
    })
  },

  me(): Promise<SessionMe> {
    return apiRequest<SessionMe>("/auth/me")
  },

  logout(): Promise<{ ok: true }> {
    return apiRequest<{ ok: true }>("/auth/logout", { method: "POST" })
  },
}

export const parcelsApi = {
  listOwn(params: ListQueryParams): Promise<Page<Parcel>> {
    return apiRequest<Page<Parcel>>("/customer/parcels", { query: { ...params } })
  },

  getOwn(id: string): Promise<ParcelDetail> {
    return apiRequest<ParcelDetail>(`/customer/parcels/${encodeURIComponent(id)}`)
  },

  createOwn(payload: CreateParcelRequest): Promise<Parcel> {
    return apiRequest<Parcel>("/customer/parcels", { method: "POST", body: payload })
  },
}

export const addressesApi = {
  list(): Promise<CustomerAddress[]> {
    return apiRequest<CustomerAddress[]>("/customer/addresses")
  },

  create(payload: CreateCustomerAddressInput): Promise<CustomerAddress> {
    return apiRequest<CustomerAddress>("/customer/addresses", { method: "POST", body: payload })
  },

  update(id: string, payload: UpdateCustomerAddressInput): Promise<CustomerAddress> {
    return apiRequest<CustomerAddress>(`/customer/addresses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: payload,
    })
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>(`/customer/addresses/${encodeURIComponent(id)}`, { method: "DELETE" })
  },
}

export const trackingApi = {
  track(trackingNumber: string): Promise<ParcelTracking> {
    return apiRequest<ParcelTracking>(`/tracking/${encodeURIComponent(trackingNumber)}`, {
      auth: false,
    })
  },
}

export const pricingApi = {
  quote(request: QuoteRequest): Promise<FeeQuote> {
    return apiRequest<FeeQuote>("/pricing/quote", {
      query: {
        pickupCityId: request.pickupCityId,
        pickupZoneId: request.pickupZoneId,
        deliveryCityId: request.deliveryCityId,
        deliveryZoneId: request.deliveryZoneId,
        weightGrams: request.weightGrams,
        codAmount: request.codAmount,
      },
    })
  },

  /** The published price list — every active lane with its slabs, one document. */
  async listPlans(): Promise<PricingLaneWithSlabs[]> {
    const page = await apiRequest<Page<PricingLaneWithSlabs>>("/customer/pricing/lanes")
    return page.nodes
  },
}

export type RiderApplicationPayload = {
  name: string
  phone: string
  email?: string
  district: string
  vehicleType: "BICYCLE" | "MOTORCYCLE" | "CAR" | "VAN" | "OTHER"
  licenseNumber?: string
  experienceYears?: number
  availability: string
  notes?: string
  consent: true
}

export const riderApplicationsApi = {
  submit(payload: RiderApplicationPayload): Promise<{ id: string; status: "PENDING" }> {
    return apiRequest<{ id: string; status: "PENDING" }>("/rider-applications", {
      method: "POST",
      auth: false,
      body: payload,
    })
  },
}

export type { OtpChannel, TokenPair }
