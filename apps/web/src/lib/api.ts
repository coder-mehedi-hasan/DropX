import { apiRequest } from "@/lib/api-client"
import type {
  CreateParcelRequest,
  CustomerSession,
  DeliveryQuote,
  ListQueryParams,
  OtpChannel,
  OtpRequestResult,
  Page,
  Parcel,
  ParcelWithItems,
  ParcelTracking,
  QuoteRequest,
  SessionMe,
  TokenPair,
} from "@/lib/types"

/**
 * Every call the customer portal is allowed to make.
 *
 * The staff `/parcels` collection is deliberately absent: a customer token is
 * refused by the API's policy layer, so the portal only ever speaks to
 * `/parcels/mine*`, plus the public `/tracking/:trackingNumber` and the
 * `web`-audience auth and pricing routes.
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
    return apiRequest<Page<Parcel>>("/parcels/mine/list", { query: { ...params } })
  },

  getOwn(id: string): Promise<ParcelWithItems> {
    return apiRequest<ParcelWithItems>(`/parcels/mine/${encodeURIComponent(id)}`)
  },

  createOwn(payload: CreateParcelRequest): Promise<Parcel> {
    return apiRequest<Parcel>("/parcels/mine", { method: "POST", body: payload })
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
  quote(request: QuoteRequest): Promise<DeliveryQuote> {
    return apiRequest<DeliveryQuote>("/pricing/quote", {
      query: {
        originZoneId: request.originZoneId,
        destinationZoneId: request.destinationZoneId,
        weightKg: request.weightKg,
        codAmount: request.codAmount,
        /**
         * The DTO is `z.coerce.boolean()`, which turns the *string* "false"
         * into `true`. The flag is therefore omitted rather than sent as false.
         */
        ...(request.express ? { express: true } : {}),
      },
    })
  },
}

export type { OtpChannel, TokenPair }
