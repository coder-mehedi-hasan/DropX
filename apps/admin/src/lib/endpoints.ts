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
import type {
  Branch,
  BranchOption,
  CreateBranchBody,
  CreateHubBody,
  CreateVehicleBody,
  CreateZoneBody,
  CustomerOption,
  DeliveryQuote,
  Hub,
  HubOption,
  LoginResult,
  ParcelTracking,
  ReferenceListParams,
  StaffIdentity,
  UpdateBranchBody,
  UpdateHubBody,
  UpdateVehicleBody,
  UpdateZoneBody,
  Vehicle,
  Zone,
  ZoneOption,
} from "./types"
import type { VehiclesSearch } from "@/routes/vehicles-search-params"
import type { ZonesSearch } from "@/routes/zones-search-params"
import type { BranchesSearch, HubsSearch } from "@/routes/org-search-params"

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
  return api.get<Page<Parcel>>("/admin/parcels", {
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
  return api.get<ParcelDetail>(`/admin/parcels/${parcelId}`, signal ? { signal } : undefined)
}

export function createParcel(body: CreateParcelBody) {
  return api.post<Parcel>("/admin/parcels", body)
}

export function updateParcelStatus(parcelId: string, body: UpdateParcelStatusBody) {
  return api.patch<Parcel>(`/admin/parcels/${parcelId}/status`, body)
}

export function cancelParcel(parcelId: string, body: CancelParcelBody) {
  return api.post<Parcel>(`/admin/parcels/${parcelId}/cancel`, body)
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

/*
 * Reference reads — the three pickers.
 *
 * `search` is omitted rather than sent empty, so an untouched combobox returns
 * the first page instead of matching the empty string against every row. The
 * picker debounces before calling these; see `use-debounced-value`.
 */

function referenceQuery(params: ReferenceListParams) {
  return {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    sortBy: params.sortBy,
    ...(params.search ? { search: params.search } : {}),
  }
}

export function listHubsForPicker(params: ReferenceListParams, signal?: AbortSignal) {
  return api.get<Page<HubOption>>("/admin/reference/hubs", {
    query: referenceQuery(params),
    ...(signal ? { signal } : {}),
  })
}

export function listZonesForPicker(params: ReferenceListParams, signal?: AbortSignal) {
  return api.get<Page<ZoneOption>>("/admin/reference/zones", {
    query: referenceQuery(params),
    ...(signal ? { signal } : {}),
  })
}

export function searchCustomersForPicker(params: ReferenceListParams, signal?: AbortSignal) {
  return api.get<Page<CustomerOption>>("/admin/reference/customers", {
    query: referenceQuery(params),
    ...(signal ? { signal } : {}),
  })
}

/** Branch lookup for the hub-create picker. Narrow projection, same as the others. */
export function listBranchesForPicker(params: ReferenceListParams, signal?: AbortSignal) {
  return api.get<Page<BranchOption>>("/admin/reference/branches", {
    query: referenceQuery(params),
    ...(signal ? { signal } : {}),
  })
}

/*
 * Organization: branches and hubs.
 *
 * These are the first Phase 1 endpoints, and they follow the same shape as
 * `listParcels`: the list takes the full query object (page, limit, sort,
 * filters, search), and the single reads take an id. `search` is omitted
 * rather than sent empty, so an untouched search box returns the first page
 * instead of matching the empty string against every row.
 */

export function listBranches(params: BranchesSearch) {
  return api.get<Page<Branch>>("/admin/branches", { query: orgQuery(params) })
}

export function getBranch(branchId: string, signal?: AbortSignal) {
  return api.get<Branch>(`/admin/branches/${branchId}`, signal ? { signal } : undefined)
}

export function createBranch(body: CreateBranchBody) {
  return api.post<Branch>("/admin/branches", body)
}

export function updateBranch(branchId: string, body: UpdateBranchBody) {
  return api.patch<Branch>(`/admin/branches/${branchId}`, body)
}

export function listHubs(params: HubsSearch) {
  return api.get<Page<Hub>>("/admin/hubs", { query: orgQuery(params) })
}

export function getHub(hubId: string, signal?: AbortSignal) {
  return api.get<Hub>(`/admin/hubs/${hubId}`, signal ? { signal } : undefined)
}

export function createHub(body: CreateHubBody) {
  return api.post<Hub>("/admin/hubs", body)
}

export function updateHub(hubId: string, body: UpdateHubBody) {
  return api.patch<Hub>(`/admin/hubs/${hubId}`, body)
}

export function listZones(params: ZonesSearch) {
  return api.get<Page<Zone>>("/admin/zones", { query: zoneQuery(params) })
}

export function getZone(zoneId: string, signal?: AbortSignal) {
  return api.get<Zone>(`/admin/zones/${zoneId}`, signal ? { signal } : undefined)
}

export function createZone(body: CreateZoneBody) {
  return api.post<Zone>("/admin/zones", body)
}

export function updateZone(zoneId: string, body: UpdateZoneBody) {
  return api.patch<Zone>(`/admin/zones/${zoneId}`, body)
}

export function listVehicles(params: VehiclesSearch) {
  return api.get<Page<Vehicle>>("/admin/vehicles", { query: vehicleQuery(params) })
}

export function getVehicle(vehicleId: string, signal?: AbortSignal) {
  return api.get<Vehicle>(`/admin/vehicles/${vehicleId}`, signal ? { signal } : undefined)
}

export function createVehicle(body: CreateVehicleBody) {
  return api.post<Vehicle>("/admin/vehicles", body)
}

export function updateVehicle(vehicleId: string, body: UpdateVehicleBody) {
  return api.patch<Vehicle>(`/admin/vehicles/${vehicleId}`, body)
}

/** Retires a vehicle from the fleet. The server owns the transition, so this
 *  sends no status — `POST /deactivate` is the only way a vehicle goes
 *  INACTIVE, and an already-inactive one comes back as 409. */
export function deactivateVehicle(vehicleId: string) {
  return api.post<Vehicle>(`/admin/vehicles/${vehicleId}/deactivate`)
}

function orgQuery(params: {
  page: number
  limit: number
  sortBy: string
  sort: "asc" | "desc"
  search: string
  status?: string
  type?: string
  branchId?: string
}) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.branchId ? { branchId: params.branchId } : {}),
  }
}

function zoneQuery(params: {
  page: number
  limit: number
  sortBy: string
  sort: "asc" | "desc"
  search: string
  status?: string
}) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
  }
}

function vehicleQuery(params: {
  page: number
  limit: number
  sortBy: string
  sort: "asc" | "desc"
  search: string
  type?: string
  status?: string
}) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.status ? { status: params.status } : {}),
  }
}
