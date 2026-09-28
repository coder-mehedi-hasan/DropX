/**
 * Endpoint functions, one per API operation the admin uses.
 *
 * Keeping the paths here means a route change is a one-line diff and the
 * `useQuery` call sites stay declarative. Nothing here catches — `api-client`
 * already throws a typed `ApiError`, and screens need to see the failure.
 */
import { api } from "./api-client"
import type {
  CancelParcelBody,
  CreateParcelBody,
  ParcelDetail,
  ParcelListParams,
  Page,
  Parcel,
  QuoteParams,
  UpdateParcelStatusBody,
} from "./parcels"
import type { DeliveryQuote, LoginResult, ParcelTracking, StaffIdentity } from "./types"

export function loginWithPassword(email: string, password: string) {
  return api.post<LoginResult>("/auth/admin/login", { email, password }, { anonymous: true })
}

export function fetchCurrentStaff(signal?: AbortSignal) {
  return api.get<StaffIdentity>("/auth/me", signal ? { signal } : undefined)
}

export function logout() {
  return api.post<{ ok: true }>("/auth/logout")
}

export function listParcels(params: ParcelListParams, signal?: AbortSignal) {
  return api.get<Page<Parcel>>("/parcels", {
    query: {
      page: params.page,
      limit: params.limit,
      sortBy: params.sortBy,
      sort: params.sort,
      search: params.search,
      status: params.status,
      hubId: params.hubId,
      paymentType: params.paymentType,
    },
    ...(signal ? { signal } : {}),
  })
}

export function getParcel(parcelId: string, signal?: AbortSignal) {
  return api.get<ParcelDetail>(`/parcels/${parcelId}`, signal ? { signal } : undefined)
}

export function createParcel(body: CreateParcelBody) {
  return api.post<Parcel>("/parcels", body)
}

export function updateParcelStatus(parcelId: string, body: UpdateParcelStatusBody) {
  return api.patch<Parcel>(`/parcels/${parcelId}/status`, body)
}

export function cancelParcel(parcelId: string, body: CancelParcelBody) {
  return api.post<Parcel>(`/parcels/${parcelId}/cancel`, body)
}

/** Public — the admin's tracking screen and the parcel timeline share this. */
export function trackParcel(trackingNumber: string, signal?: AbortSignal) {
  return api.get<ParcelTracking>(`/tracking/${encodeURIComponent(trackingNumber)}`, {
    anonymous: true,
    ...(signal ? { signal } : {}),
  })
}

export function quoteDeliveryFee(params: QuoteParams, signal?: AbortSignal) {
  return api.get<DeliveryQuote>("/pricing/quote", {
    query: {
      originZoneId: params.originZoneId,
      destinationZoneId: params.destinationZoneId,
      weightKg: params.weightKg,
      codAmount: params.codAmount,
      express: params.express,
    },
    ...(signal ? { signal } : {}),
  })
}
