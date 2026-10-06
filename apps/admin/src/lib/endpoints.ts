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
  AssignPickupBody,
  CreatePickupBody,
  CreateRiderBody,
  CreateRoleBody,
  CreateRouteBody,
  CreateTransferBody,
  CreateZoneBody,
  CreateUserBody,
  Customer,
  CustomerOption,
  CustomerWithAddresses,
  DeliveryQuote,
  Hub,
  HubOption,
  LoginResult,
  ParcelTracking,
  PricingRule,
  CreatePricingRuleBody,
  UpdatePricingRuleBody,
  ReferenceListParams,
  ResetPasswordBody,
  RoleDetail,
  RoleOption,
  Pickup,
  Rider,
  RiderApplication,
  ApproveRiderApplicationBody,
  RiderLocation,
  Route,
  RouteStop,
  RouteStopInput,
  StaffIdentity,
  StaffUser,
  TransferListItem,
  TransferManifestParcel,
  TransferWithManifest,
  UpdateBranchBody,
  UpdateHubBody,
  UpdatePickupStatusBody,
  UpdateRiderBody,
  UpdateTransferBody,
  UpdateTransferStatusBody,
  UpdateRouteBody,
  UpdateUserBody,
  UpdateVehicleBody,
  UpdateZoneBody,
  UserStatus,
  Vehicle,
  Zone,
  ZoneOption,
  ReplaceTransferManifestBody,
  ReplacePermissionsBody,
  CreateDeliveryBody,
  ReassignDeliveryBody,
  UpdateDeliveryStatusBody,
  DeliveryRow,
  DeliveryProofRow,
} from "./types"
import type { VehiclesSearch } from "@/routes/vehicles-search-params"
import type { ZonesSearch } from "@/routes/zones-search-params"
import type { PricingRulesSearch } from "@/routes/pricing-rules-search-params"
import type { RoutesSearch } from "@/routes/routes-search-params"
import type { RidersSearch } from "@/routes/riders-search-params"
import type { RiderLocationsSearch } from "@/routes/rider-locations-search-params"
import type { RiderApplicationsSearch } from "@/routes/rider-applications-search-params"
import type { PickupsSearch } from "@/routes/pickups-search-params"
import type { TransfersSearch } from "@/routes/transfers-search-params"
import type { DeliveriesSearch } from "@/routes/deliveries-search-params"
import type { DeliveryProofsSearch } from "@/routes/delivery-proofs-search-params"
import type { BranchesSearch, HubsSearch } from "@/routes/org-search-params"
import type { UsersSearch } from "@/routes/users-search-params"
import type { RolesSearch } from "@/routes/roles-search-params"
import type { CustomersSearch } from "@/routes/customers-search-params"

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
      ...(params.customerId ? { customerId: params.customerId } : {}),
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

export function listPricingRules(params: PricingRulesSearch) {
  return api.get<Page<PricingRule>>("/pricing/rules", { query: pricingRuleQuery(params) })
}

export function getPricingRule(pricingRuleId: string, signal?: AbortSignal) {
  return api.get<PricingRule>(`/pricing/rules/${pricingRuleId}`, signal ? { signal } : undefined)
}

export function createPricingRule(body: CreatePricingRuleBody) {
  return api.post<PricingRule>("/pricing/rules", body)
}

export function updatePricingRule(pricingRuleId: string, body: UpdatePricingRuleBody) {
  return api.patch<PricingRule>(`/pricing/rules/${pricingRuleId}`, body)
}

export function deletePricingRule(pricingRuleId: string) {
  return api.delete<void>(`/pricing/rules/${pricingRuleId}`)
}

export function listRiders(params: RidersSearch) {
  return api.get<Page<Rider>>("/admin/riders", { query: riderQuery(params) })
}

export function getRider(riderId: string, signal?: AbortSignal) {
  return api.get<Rider>(`/admin/riders/${riderId}`, signal ? { signal } : undefined)
}

export function createRider(body: CreateRiderBody) {
  return api.post<Rider>("/admin/riders", body)
}

export function updateRider(riderId: string, body: UpdateRiderBody) {
  return api.patch<Rider>(`/admin/riders/${riderId}`, body)
}

export function setRiderStatus(riderId: string, status: Rider["status"]) {
  return api.post<Rider>(`/admin/riders/${riderId}/status`, { status })
}

export function listRiderApplications(params: RiderApplicationsSearch) {
  return api.get<Page<RiderApplication>>("/admin/rider-applications", {
    query: {
      page: params.page,
      limit: params.limit,
      sortBy: params.sortBy,
      sort: params.sort,
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
  })
}

export function updateRiderApplicationStatus(id: string, status: RiderApplication["status"]) {
  return api.patch<RiderApplication>(`/admin/rider-applications/${id}/status`, { status })
}

export function approveRiderApplication(id: string, body: ApproveRiderApplicationBody) {
  return api.post<{ application: RiderApplication; riderId: string }>(
    `/admin/rider-applications/${id}/approve`,
    body,
  )
}

/**
 * Read-only by design: fixes are pushed by the rider app, so dispatch reads the
 * trail and never writes into it.
 */
export function listRiderLocations(params: RiderLocationsSearch) {
  return api.get<Page<RiderLocation>>("/admin/rider-locations", {
    query: {
      page: params.page,
      limit: params.limit,
      sortBy: params.sortBy,
      sort: params.sort,
      ...(params.riderId ? { riderId: params.riderId } : {}),
    },
  })
}

/**
 * The rider roster narrowed for a picker. `listRiders` would do, but it sends the
 * full list query the table screen uses; the picker asks for a page and a search
 * term and nothing else, so the control cannot pull a thousand riders to show
 * twenty-five of them.
 */
export function listRidersForPicker(
  params: { page: number; limit: number; search?: string },
  signal?: AbortSignal,
) {
  return api.get<Page<Rider>>("/admin/riders", {
    query: params,
    ...(signal ? { signal } : {}),
  })
}

/*
 * Staff accounts. Create writes the account and both assignment sets in one
 * transaction, so the picker's roles and hubs have to be resolved before the
 * request leaves — hence the two reads below living beside these writes.
 */
export function listUsers(params: UsersSearch) {
  return api.get<Page<StaffUser>>("/admin/users", { query: usersQuery(params) })
}

export function getUser(userId: string, signal?: AbortSignal) {
  return api.get<StaffUser>(`/admin/users/${userId}`, signal ? { signal } : undefined)
}

export function createUser(body: CreateUserBody) {
  return api.post<StaffUser>("/admin/users", body)
}

export function updateUser(userId: string, body: UpdateUserBody) {
  return api.patch<StaffUser>(`/admin/users/${userId}`, body)
}

export function resetUserPassword(userId: string, body: ResetPasswordBody) {
  return api.post<StaffUser>(`/admin/users/${userId}/reset-password`, body)
}

export function setUserStatus(userId: string, status: UserStatus) {
  return api.post<StaffUser>(`/admin/users/${userId}/status`, { status })
}

/**
 * Roles, one endpoint function for both readers: the user form's picker asks
 * for a page of names in checkbox order, the roles screen for a paged list —
 * `rolesQuery` below covers both shapes rather than two functions drifting on
 * one path. `getRole` is the matrix's detail read, the one carrying the grant
 * set, and `replaceRolePermissions` is its write: the whole key set, PUT.
 */
export function listRoles(params: RolesSearch) {
  return api.get<Page<RoleOption>>("/admin/roles", { query: rolesQuery(params) })
}

export function getRole(roleId: string, signal?: AbortSignal) {
  return api.get<RoleDetail>(`/admin/roles/${roleId}`, signal ? { signal } : undefined)
}

export function createRole(body: CreateRoleBody) {
  return api.post<RoleOption>("/admin/roles", body)
}

export function replaceRolePermissions(roleId: string, body: ReplacePermissionsBody) {
  return api.put<RoleDetail>(`/admin/roles/${roleId}/permissions`, body)
}

/**
 * Customers — the support surface. Addresses ride along in the read (the OTP
 * portal owns them, staff never writes them), so the read type is
 * `CustomerWithAddresses` and the list is the plain `Customer`. `activate` is
 * the one write, against a TEMP row only.
 */
export function listCustomers(params: CustomersSearch, signal?: AbortSignal) {
  return api.get<Page<Customer>>("/admin/customers", {
    query: customersQuery(params),
    ...(signal ? { signal } : {}),
  })
}

export function getCustomer(customerId: string, signal?: AbortSignal) {
  return api.get<CustomerWithAddresses>(
    `/admin/customers/${customerId}`,
    signal ? { signal } : undefined,
  )
}

export function activateCustomer(customerId: string) {
  return api.post<Customer>(`/admin/customers/${customerId}/activate`)
}

export function listPickups(params: PickupsSearch) {
  return api.get<Page<Pickup>>("/admin/pickups", { query: pickupQuery(params) })
}

export function createPickup(body: CreatePickupBody) {
  return api.post<Pickup>("/admin/pickups", body)
}

export function assignPickup(pickupId: string, body: AssignPickupBody) {
  return api.post<Pickup>(`/admin/pickups/${pickupId}/assign`, body)
}

export function updatePickupStatus(pickupId: string, body: UpdatePickupStatusBody) {
  return api.patch<Pickup>(`/admin/pickups/${pickupId}/status`, body)
}

export function listTransfers(params: TransfersSearch) {
  return api.get<Page<TransferListItem>>("/admin/transfers", { query: transferQuery(params) })
}

export function getTransfer(transferId: string, signal?: AbortSignal) {
  return api.get<TransferWithManifest>(
    `/admin/transfers/${transferId}`,
    signal ? { signal } : undefined,
  )
}

export function createTransfer(body: CreateTransferBody) {
  return api.post<TransferWithManifest>("/admin/transfers", body)
}

export function updateTransfer(transferId: string, body: UpdateTransferBody) {
  return api.patch<TransferWithManifest>(`/admin/transfers/${transferId}`, body)
}

export function deleteTransfer(transferId: string) {
  return api.delete(`/admin/transfers/${transferId}`)
}

export function updateTransferStatus(transferId: string, body: UpdateTransferStatusBody) {
  return api.patch<TransferWithManifest>(`/admin/transfers/${transferId}/status`, body)
}

export function listTransferManifest(transferId: string, signal?: AbortSignal) {
  return api.get<TransferManifestParcel[]>(
    `/admin/transfers/${transferId}/parcels`,
    signal ? { signal } : undefined,
  )
}

export function replaceTransferManifest(transferId: string, body: ReplaceTransferManifestBody) {
  return api.put<TransferManifestParcel[]>(`/admin/transfers/${transferId}/parcels`, body)
}

export function listDeliveries(params: DeliveriesSearch) {
  return api.get<Page<DeliveryRow>>("/admin/deliveries", { query: deliveryQuery(params) })
}

export function getDelivery(deliveryId: string, signal?: AbortSignal) {
  return api.get<DeliveryRow>(`/admin/deliveries/${deliveryId}`, signal ? { signal } : undefined)
}

export function createDelivery(body: CreateDeliveryBody) {
  return api.post<DeliveryRow>("/admin/deliveries", body)
}

export function reassignDelivery(deliveryId: string, body: ReassignDeliveryBody) {
  return api.patch<DeliveryRow>(`/admin/deliveries/${deliveryId}`, body)
}

export function updateDeliveryStatus(deliveryId: string, body: UpdateDeliveryStatusBody) {
  return api.patch<DeliveryRow>(`/admin/deliveries/${deliveryId}/status`, body)
}

export function listDeliveryProofs(params: DeliveryProofsSearch) {
  return api.get<Page<DeliveryProofRow>>("/admin/delivery-proofs", {
    query: deliveryProofQuery(params),
  })
}

export function verifyDeliveryProof(proofId: string) {
  return api.patch<DeliveryProofRow>(`/admin/delivery-proofs/${proofId}/verify`, {})
}

export function listRoutes(params: RoutesSearch) {
  return api.get<Page<Route>>("/routes", { query: routeQuery(params) })
}

export function getRoute(routeId: string, signal?: AbortSignal) {
  return api.get<Route>(`/routes/${routeId}`, signal ? { signal } : undefined)
}

export function createRoute(body: CreateRouteBody) {
  return api.post<Route>("/routes", body)
}

export function updateRoute(routeId: string, body: UpdateRouteBody) {
  return api.patch<Route>(`/routes/${routeId}`, body)
}

export function deleteRoute(routeId: string) {
  return api.delete<void>(`/routes/${routeId}`)
}

export function listRouteStops(routeId: string, signal?: AbortSignal) {
  return api.get<RouteStop[]>(`/routes/${routeId}/stops`, signal ? { signal } : undefined)
}

export function replaceRouteStops(routeId: string, stops: RouteStopInput[]) {
  return api.put<RouteStop[]>(`/routes/${routeId}/stops`, { stops })
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

function pricingRuleQuery(params: {
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

function riderQuery(params: RidersSearch) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.compensationType ? { compensationType: params.compensationType } : {}),
    ...(params.hubId ? { hubId: params.hubId } : {}),
  }
}

function usersQuery(params: UsersSearch) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.branchId ? { branchId: params.branchId } : {}),
  }
}

function rolesQuery(params: RolesSearch) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
  }
}

function customersQuery(params: CustomersSearch) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
  }
}

function transferQuery(params: TransfersSearch) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
    // Sent even though a transfer has two hubs: the API matches `hubId` against
    // either end, so this is the one filter a dispatcher can narrow on without
    // leaving the screen.
    ...(params.hubId ? { hubId: params.hubId } : {}),
    ...(params.vehicleId ? { vehicleId: params.vehicleId } : {}),
    ...(params.driverId ? { driverId: params.driverId } : {}),
  }
}

function deliveryQuery(params: DeliveriesSearch) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.hubId ? { hubId: params.hubId } : {}),
    ...(params.riderId ? { riderId: params.riderId } : {}),
  }
}

function deliveryProofQuery(params: DeliveryProofsSearch) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.verified ? { verified: params.verified } : {}),
    ...(params.deliveryId ? { deliveryId: params.deliveryId } : {}),
  }
}

function pickupQuery(params: PickupsSearch) {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sort: params.sort,
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.riderId ? { riderId: params.riderId } : {}),
    // Sent even though the hub is never a column here: the API scopes the list by
    // the *parcel's* hub, so this is the one filter a dispatcher can narrow on
    // without leaving the screen.
    ...(params.hubId ? { hubId: params.hubId } : {}),
  }
}

function routeQuery(params: {
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
