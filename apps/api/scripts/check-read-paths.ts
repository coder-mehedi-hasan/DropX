/**
 * Temporary read-only schema conformance check.
 *
 * The database is schema-only, so no read path has ever actually executed. This
 * exercises every SELECT against the real schema: a valid query returns empty
 * results, while a bad column or table reference throws a DatabaseError. Writes
 * are not exercised, and nothing here mutates data.
 */
import mysql from "mysql2/promise"

import { closePool } from "../src/db/pool"
import { Context } from "hono"
import type { ListParams } from "../src/db/models"

import { DomainError } from "../src/core"
import type { Scope } from "../src/shared/auth/auth-context"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set")
}

const pool = mysql.createPool(DATABASE_URL)

/**
 * Hono keeps request variables in a private map that `c.get`/`c.set` are the
 * only accessors for. Defining a `db` property on the instance does not populate
 * it, so every repository's `c.get("db")` came back `undefined` and the whole
 * run failed identically — which is indistinguishable from the check passing.
 */
const ctx = new Context(new Request("http://localhost/"), {} as any) as any
ctx.set("db", pool)

type Case = {
  name: string
  run: () => Promise<unknown>
}

const cases: Case[] = []

const track = await import("../src/modules/tracking/tracking.repository")
const jobs = await import("../src/modules/jobs/jobs.repository")
const parcels = await import("../src/modules/parcels/parcels.repository")
const auth = await import("../src/modules/auth/auth.repository")
const actors = await import("../src/shared/auth/actor-loader")
const pricing = await import("../src/modules/pricing/pricing.service")
const reference = await import("../src/modules/reference/reference.repository")
const org = await import("../src/modules/org/org.repository")
const locations = await import("../src/modules/locations/locations.repository")
const pricingLanes = await import("../src/modules/pricing/pricing-lanes.repository")
const vehicles = await import("../src/modules/vehicles/vehicles.repository")
const routes = await import("../src/modules/routes/routes.repository")
const riders = await import("../src/modules/riders/riders.repository")
const riderLocations = await import("../src/modules/riders/rider-locations.repository")
const pickups = await import("../src/modules/pickups/pickups.repository")
const deliveries = await import("../src/modules/deliveries/deliveries.repository")
const deliveryProofs = await import("../src/modules/deliveries/delivery-proofs.repository")
const transfers = await import("../src/modules/transfers/transfers.repository")
const users = await import("../src/modules/users/users.repository")
const roles = await import("../src/modules/roles/roles.repository")
const customers = await import("../src/modules/customers/customers.repository")
const payments = await import("../src/modules/payments/payments.repository")
const settlements = await import("../src/modules/settlements/settlements.repository")

const scope: Scope = {
  userId: "1",
  branchId: null,
  hubIds: [],
  isCompanyWide: true,
}
const listParams: ListParams = { page: 1, limit: 10, offset: 0, sort: "desc" }
/**
 * The sort allowlist as the handler actually receives it: the published
 * camelCase keys mapped to their SQL columns. Using the bare SQL columns here
 * would validate the query builder and nothing else — it is how a client
 * sorting by `createdAt` slipped through as a 500.
 */
const parcelSortByKey = {
  createdAt: "p.created_at",
  updatedAt: "p.updated_at",
  trackingNumber: "p.tracking_number",
  status: "p.status",
  weight: "p.weight",
} as const

// Mirrors the published contract (`PARCEL_SEARCH_COLUMNS` in parcels.dto). The
// join-check matters: these columns reference the `customers r` alias, and a
// filtered list whose FROM omitted that join 500ed for every caller — a search
// typed into the parcel list — while the no-search case passed. Only a case
// that actually passes `searchFields` can see that.
const parcelsSearchColumns = ["p.tracking_number", "r.name", "r.phone"]

cases.push(
  {
    name: "tracking.findByTrackingNumber",
    run: () => track.trackingRepository.findByTrackingNumber(pool, "DX-TEST-0001"),
  },
  { name: "tracking.findEvents", run: () => track.trackingRepository.findEvents(pool, "1") },

  {
    name: "jobs.listJobsForRider",
    run: () => jobs.listJobsForRider(pool, "1", listParams, undefined, undefined),
  },
  {
    name: "jobs.listJobsForRider(status)",
    run: () => jobs.listJobsForRider(pool, "1", listParams, "ASSIGNED", undefined),
  },
  { name: "jobs.findJobForRider", run: () => jobs.findJobForRider(pool, "1", "1") },
  { name: "jobs.listJobItems", run: () => jobs.listJobItems(pool, "1") },
  {
    name: "jobs.findOpenAttemptForUpdate",
    run: () => jobs.findOpenAttemptForUpdate(pool, "1", "1"),
  },

  {
    name: "parcels.listParcels",
    run: () => parcels.listParcels(pool, scope, listParams, {}, parcelSortByKey),
  },
  {
    name: "parcels.listParcels(filtered)",
    run: () =>
      parcels.listParcels(
        pool,
        scope,
        { ...listParams, sortBy: "createdAt" },
        {
          status: "CREATED",
          search: "DX",
          searchFields: parcelsSearchColumns,
          hubId: "1",
          paymentType: "COD",
          customerId: "1",
        },
        parcelSortByKey,
      ),
  },
  ...(["createdAt", "updatedAt", "trackingNumber", "status", "weight"] as const).map((sortBy) => ({
    name: `parcels.listParcels(sortBy=${sortBy})`,
    run: () => parcels.listParcels(pool, scope, { ...listParams, sortBy }, {}, parcelSortByKey),
  })),
  {
    // Scoped, because a scope clause that names an alias the FROM does not join
    // fails *only* for a scoped caller. The company-wide case above passes either
    // way, which is how this shipped broken for every branch manager.
    name: "parcels.listParcels(branch-scoped)",
    run: () =>
      parcels.listParcels(
        pool,
        { ...scope, isCompanyWide: false, branchId: "1" },
        listParams,
        {},
        parcelSortByKey,
      ),
  },
  {
    name: "parcels.listParcels(hub-scoped)",
    run: () =>
      parcels.listParcels(
        pool,
        { ...scope, isCompanyWide: false, hubIds: ["1"] },
        listParams,
        { status: "CREATED" },
        parcelSortByKey,
      ),
  },
  {
    name: "parcels.findParcelById(branch-scoped)",
    run: () => parcels.findParcelById(pool, { ...scope, isCompanyWide: false, branchId: "1" }, "1"),
  },
  {
    name: "parcels.findParcelById(hub-scoped)",
    run: () => parcels.findParcelById(pool, { ...scope, isCompanyWide: false, hubIds: ["1"] }, "1"),
  },
  {
    name: "parcels.findParcelByTrackingNumber",
    run: () => parcels.findParcelByTrackingNumber(pool, "DX-TEST-0001"),
  },
  {
    name: "parcels.listParcelsForCustomer",
    run: () => parcels.listParcelsForCustomer(pool, "1", listParams, {}, parcelSortByKey),
  },
  ...(["createdAt", "updatedAt", "trackingNumber", "status", "weight"] as const).map((sortBy) => ({
    name: `parcels.listParcelsForCustomer(sortBy=${sortBy})`,
    run: () =>
      parcels.listParcelsForCustomer(pool, "1", { ...listParams, sortBy }, {}, parcelSortByKey),
  })),
  {
    name: "parcels.findParcelForCustomer",
    run: () => parcels.findParcelForCustomer(pool, "1", "1"),
  },
  { name: "parcels.listParcelItems", run: () => parcels.listParcelItems(pool, "1") },
  { name: "parcels.listParcelAddresses", run: () => parcels.listParcelAddresses(pool, "1") },

  {
    name: "auth.findUserByEmail",
    run: () => auth.authRepository.findUserByEmail(pool, "nobody@example.com"),
  },
  { name: "auth.findRiderByUserId", run: () => auth.authRepository.findRiderByUserId(pool, "1") },
  {
    name: "auth.findCustomerByIdentifier",
    run: () => auth.authRepository.findCustomerByIdentifier(pool, "nobody@example.com"),
  },
  { name: "auth.findCustomerById", run: () => auth.authRepository.findCustomerById(pool, "1") },

  { name: "actor.loadStaffActor", run: () => actors.loadStaffActor(pool, "1") },
  { name: "actor.loadRiderActor", run: () => actors.loadRiderActor(pool, "1") },
  { name: "actor.loadCustomerActor", run: () => actors.loadCustomerActor(pool, "1") },

  // Reference reads. Every sort key is exercised, because `sortBy` arrives from
  // a client and the allowlist is the only thing standing between it and the SQL
  // — a column that exists in the schema but not in the allowlist must fail, and
  // one in the allowlist but not the schema must fail here.
  { name: "reference.listHubRefs", run: () => reference.listHubRefs(pool, scope, listParams, {}) },
  {
    name: "reference.listHubRefs(search)",
    run: () => reference.listHubRefs(pool, scope, listParams, { search: "a" }),
  },
  {
    name: "reference.listHubRefs(type)",
    run: () => reference.listHubRefs(pool, scope, listParams, { type: "ORIGIN" }),
  },
  {
    name: "reference.listHubRefs(status)",
    run: () => reference.listHubRefs(pool, scope, listParams, { status: "ACTIVE" }),
  },
  {
    name: "reference.listHubRefs(branch-scoped)",
    run: () =>
      reference.listHubRefs(
        pool,
        { ...scope, isCompanyWide: false, branchId: "1" },
        listParams,
        {},
      ),
  },
  {
    name: "reference.listHubRefs(hub-scoped)",
    run: () =>
      reference.listHubRefs(
        pool,
        { ...scope, isCompanyWide: false, hubIds: ["1"] },
        listParams,
        {},
      ),
  },
  {
    name: "reference.searchCustomerRefs",
    run: () => reference.searchCustomerRefs(pool, listParams, {}),
  },
  {
    name: "reference.searchCustomerRefs(search)",
    run: () => reference.searchCustomerRefs(pool, listParams, { search: "a" }),
  },

  // Each sort key, so a rename in the schema or the allowlist is caught here.
  ...(["name", "code", "type", "status"] as const).map((sortBy) => ({
    name: `reference.listHubRefs(sortBy=${sortBy})`,
    run: () => reference.listHubRefs(pool, scope, { ...listParams, sortBy }, {}),
  })),
  ...(["name", "phone", "createdAt"] as const).map((sortBy) => ({
    name: `reference.searchCustomerRefs(sortBy=${sortBy})`,
    run: () => reference.searchCustomerRefs(pool, { ...listParams, sortBy }, {}),
  })),

  {
    name: "pricing.quoteDeliveryFee",
    run: () =>
      pricing.quoteDeliveryFee(ctx, {
        pickupCityId: "1",
        pickupZoneId: "1",
        deliveryCityId: "2",
        deliveryZoneId: "2",
        weightGrams: 2500,
        codAmount: 1000,
      }),
  },
  {
    name: "pricing.quoteDeliveryFee(prepaid)",
    run: () =>
      pricing.quoteDeliveryFee(ctx, {
        pickupCityId: "1",
        pickupZoneId: "1",
        deliveryCityId: "2",
        deliveryZoneId: "2",
        weightGrams: 500,
        codAmount: 0,
      }),
  },

  // --- Organization: branches and hubs ------------------------------------
  //
  // Every sort key, because `sortBy` arrives from a client and the allowlist is
  // the only thing between it and the SQL. This is the same discipline the
  // parcels list exercise applies — a key the allowlist does not name is a 422
  // at the validator, and a key it names but the column does not exist is a 500.
  ...(["name", "code", "status", "createdAt"] as const).map((sortBy) => ({
    name: `org.listBranches(sortBy=${sortBy})`,
    run: () =>
      org.selectBranches(pool, { ...listParams, sortBy }, { status: undefined, search: undefined }),
  })),
  { name: "org.selectBranch", run: () => org.selectBranch(pool, "1") },
  ...(["name", "code", "type", "status", "createdAt"] as const).map((sortBy) => ({
    name: `org.listHubs(sortBy=${sortBy})`,
    run: () =>
      org.selectHubs(
        pool,
        { ...listParams, sortBy },
        {
          branchId: undefined,
          type: undefined,
          status: undefined,
          search: undefined,
        },
      ),
  })),
  { name: "org.selectHub", run: () => org.selectHub(pool, "1") },

  // --- Locations: cities, zones, areas --------------------------------------
  {
    name: "locations.selectServiceCities",
    run: () => locations.selectServiceCities(pool, listParams, {}),
  },
  ...(["name", "code", "serviceType", "status", "createdAt"] as const).map((sortBy) => ({
    name: `locations.selectServiceCities(sortBy=${sortBy})`,
    run: () => locations.selectServiceCities(pool, { ...listParams, sortBy }, {}),
  })),
  {
    name: "locations.selectServiceCities(status+search)",
    run: () =>
      locations.selectServiceCities(pool, listParams, { status: "ACTIVE", search: "DHAKA" }),
  },
  { name: "locations.selectServiceCity", run: () => locations.selectServiceCity(pool, "1") },

  {
    name: "locations.selectServiceZones",
    run: () => locations.selectServiceZones(pool, listParams, {}),
  },
  ...(["name", "code", "status", "createdAt"] as const).map((sortBy) => ({
    name: `locations.selectServiceZones(sortBy=${sortBy})`,
    run: () => locations.selectServiceZones(pool, { ...listParams, sortBy }, {}),
  })),
  {
    name: "locations.selectServiceZones(cityId+status+search)",
    run: () =>
      locations.selectServiceZones(pool, listParams, {
        cityId: "1",
        status: "ACTIVE",
        search: "DHAN",
      }),
  },
  { name: "locations.selectServiceZone", run: () => locations.selectServiceZone(pool, "1") },

  {
    name: "locations.selectServiceAreas",
    run: () => locations.selectServiceAreas(pool, listParams, {}),
  },
  ...(["name", "code", "status", "createdAt"] as const).map((sortBy) => ({
    name: `locations.selectServiceAreas(sortBy=${sortBy})`,
    run: () => locations.selectServiceAreas(pool, { ...listParams, sortBy }, {}),
  })),
  {
    name: "locations.selectServiceAreas(zoneId+status+search)",
    run: () =>
      locations.selectServiceAreas(pool, listParams, {
        zoneId: "1",
        status: "ACTIVE",
        search: "BADAM",
      }),
  },
  { name: "locations.selectServiceArea", run: () => locations.selectServiceArea(pool, "1") },
  {
    name: "locations.codeExistsUnderParent(zones)",
    run: () => locations.codeExistsUnderParent(pool, "service_zones", { cityId: "1" }, "DHANMONDI"),
  },
  {
    name: "locations.codeExistsUnderParent(areas)",
    run: () => locations.codeExistsUnderParent(pool, "service_areas", { zoneId: "1" }, "BADAMTOLA"),
  },

  // --- Pricing lanes and slabs ----------------------------------------------
  {
    name: "pricingLanes.selectPricingLanes",
    run: () => pricingLanes.selectPricingLanes(pool, listParams, {}),
  },
  {
    name: "pricingLanes.selectPricingLanes(status+sort)",
    run: () =>
      pricingLanes.selectPricingLanes(pool, { ...listParams, sort: "asc" }, { status: "ACTIVE" }),
  },
  ...(["pickupType", "deliveryType", "status", "createdAt"] as const).map((sortBy) => ({
    name: `pricingLanes.selectPricingLanes(sortBy=${sortBy})`,
    run: () => pricingLanes.selectPricingLanes(pool, { ...listParams, sortBy }, {}),
  })),
  { name: "pricingLanes.selectPricingLane", run: () => pricingLanes.selectPricingLane(pool, "1") },
  {
    name: "pricingLanes.selectSlabsForLanes",
    run: () => pricingLanes.selectSlabsForLanes(pool, ["1", "2", "3"]),
  },
  { name: "pricingLanes.selectLaneSlabs", run: () => pricingLanes.selectLaneSlabs(pool, "1") },
  { name: "pricingLanes.selectSlab", run: () => pricingLanes.selectSlab(pool, "1") },
  {
    name: "pricingLanes.selectOverlappingSlab",
    run: () => pricingLanes.selectOverlappingSlab(pool, "1", 0, 500),
  },

  // --- Fleet: vehicles ------------------------------------------------------
  { name: "vehicles.selectVehicles", run: () => vehicles.selectVehicles(pool, listParams, {}) },
  {
    name: "vehicles.selectVehicles(status)",
    run: () => vehicles.selectVehicles(pool, listParams, { status: "AVAILABLE" }),
  },
  {
    name: "vehicles.selectVehicles(type)",
    run: () => vehicles.selectVehicles(pool, listParams, { type: "VAN" }),
  },
  {
    name: "vehicles.selectVehicles(search)",
    run: () => vehicles.selectVehicles(pool, listParams, { search: "DHK-1234" }),
  },
  ...(["registrationNumber", "type", "status", "capacityKg", "createdAt"] as const).map(
    (sortBy) => ({
      name: `vehicles.selectVehicles(sortBy=${sortBy})`,
      run: () => vehicles.selectVehicles(pool, { ...listParams, sortBy }, {}),
    }),
  ),
  // Filter + sort together — see the zones note above for why neither alone suffices.
  ...(["registrationNumber", "type", "status", "capacityKg", "createdAt"] as const).map(
    (sortBy) => ({
      name: `vehicles.selectVehicles(type+status+search+sortBy=${sortBy})`,
      run: () =>
        vehicles.selectVehicles(
          pool,
          { ...listParams, sortBy, sort: "desc" as const },
          {
            type: "VAN",
            status: "AVAILABLE",
            search: "DHK-1234",
          },
        ),
    }),
  ),
  { name: "vehicles.selectVehicle", run: () => vehicles.selectVehicle(pool, "1") },

  // --- Routes ---------------------------------------------------------------
  { name: "routes.selectRoutes", run: () => routes.selectRoutes(pool, listParams, {}) },
  {
    name: "routes.selectRoutes(status)",
    run: () => routes.selectRoutes(pool, listParams, { status: "ACTIVE" }),
  },
  {
    name: "routes.selectRoutes(search)",
    run: () => routes.selectRoutes(pool, listParams, { search: "DHAKA" }),
  },
  ...(["name", "code", "status", "createdAt"] as const).map((sortBy) => ({
    name: `routes.selectRoutes(sortBy=${sortBy})`,
    run: () => routes.selectRoutes(pool, { ...listParams, sortBy }, {}),
  })),
  { name: "routes.selectRoute", run: () => routes.selectRoute(pool, "1") },
  { name: "routes.selectStops", run: () => routes.selectStops(pool, "1") },

  // --- Riders ---------------------------------------------------------------
  { name: "riders.selectRiders", run: () => riders.selectRiders(pool, listParams, {}) },
  {
    name: "riders.selectRiders(status)",
    run: () => riders.selectRiders(pool, listParams, { status: "AVAILABLE" }),
  },
  {
    name: "riders.selectRiders(compensationType)",
    run: () => riders.selectRiders(pool, listParams, { compensationType: "SALARIED" }),
  },
  {
    name: "riders.selectRiders(hubId)",
    run: () => riders.selectRiders(pool, listParams, { hubId: "1" }),
  },
  {
    name: "riders.selectRiders(search)",
    run: () => riders.selectRiders(pool, listParams, { search: "RIDER" }),
  },
  ...(["employeeCode", "status", "hubId", "createdAt"] as const).map((sortBy) => ({
    name: `riders.selectRiders(sortBy=${sortBy})`,
    run: () => riders.selectRiders(pool, { ...listParams, sortBy }, {}),
  })),
  { name: "riders.selectRider", run: () => riders.selectRider(pool, "1") },
  { name: "riders.selectRiderByUserId", run: () => riders.selectRiderByUserId(pool, "1") },

  // --- Rider locations ------------------------------------------------------
  {
    name: "riderLocations.selectRiderLocations",
    run: () => riderLocations.selectRiderLocations(pool, listParams, {}),
  },
  {
    name: "riderLocations.selectRiderLocations(riderId)",
    run: () => riderLocations.selectRiderLocations(pool, listParams, { riderId: "1" }),
  },
  ...(["recordedAt"] as const).map((sortBy) => ({
    name: `riderLocations.selectRiderLocations(sortBy=${sortBy})`,
    run: () =>
      riderLocations.selectRiderLocations(pool, { ...listParams, sortBy }, { riderId: "1" }),
  })),

  // --- Pickups --------------------------------------------------------------
  // Scoped variants are not optional here. A scope clause that references an
  // alias the FROM clause does not join fails only for a *scoped* caller, so a
  // company-wide read over an empty database proves nothing about the guard it
  // was written to provide.
  { name: "pickups.selectPickups", run: () => pickups.selectPickups(pool, scope, listParams, {}) },
  {
    name: "pickups.selectPickups(status)",
    run: () => pickups.selectPickups(pool, scope, listParams, { status: "REQUESTED" }),
  },
  {
    name: "pickups.selectPickups(riderId)",
    run: () => pickups.selectPickups(pool, scope, listParams, { riderId: "1" }),
  },
  {
    name: "pickups.selectPickups(hubId)",
    run: () => pickups.selectPickups(pool, scope, listParams, { hubId: "1" }),
  },
  {
    name: "pickups.selectPickups(search)",
    run: () => pickups.selectPickups(pool, scope, listParams, { search: "a" }),
  },
  ...(["scheduledAt", "status", "createdAt"] as const).map((sortBy) => ({
    name: `pickups.selectPickups(sortBy=${sortBy})`,
    run: () => pickups.selectPickups(pool, scope, { ...listParams, sortBy }, {}),
  })),
  {
    name: "pickups.selectPickups(branch-scoped)",
    run: () =>
      pickups.selectPickups(
        pool,
        { ...scope, isCompanyWide: false, branchId: "1" },
        listParams,
        {},
      ),
  },
  {
    name: "pickups.selectPickups(hub-scoped)",
    run: () =>
      pickups.selectPickups(
        pool,
        { ...scope, isCompanyWide: false, hubIds: ["1"] },
        listParams,
        {},
      ),
  },
  { name: "pickups.selectPickup", run: () => pickups.selectPickup(pool, scope, "1") },
  {
    name: "pickups.selectPickup(branch-scoped)",
    run: () => pickups.selectPickup(pool, { ...scope, isCompanyWide: false, branchId: "1" }, "1"),
  },
  {
    name: "parcels.lockScopedParcelForUpdate",
    run: () => parcels.lockScopedParcelForUpdate(pool, scope, "1"),
  },
  {
    name: "parcels.lockScopedParcelForUpdate(hub-scoped)",
    run: () =>
      parcels.lockScopedParcelForUpdate(
        pool,
        { ...scope, isCompanyWide: false, hubIds: ["1"] },
        "1",
      ),
  },
  { name: "pickups.countOpenPickups", run: () => pickups.countOpenPickups(pool, "1") },
  // ---- transfers ------------------------------------------------------------
  //
  // Both scope clauses are exercised here, because a transfer is visible from
  // either end (`from_hub_id` OR `to_hub_id`) while a write is scoped to the
  // origin alone. Each clause is built over the same joins the read query uses, so
  // a scoped caller runs exactly the alias a company-wide caller never touches.
  {
    name: "transfers.selectTransfers",
    run: () => transfers.selectTransfers(pool, scope, listParams, {}),
  },
  {
    name: "transfers.selectTransfers(status)",
    run: () => transfers.selectTransfers(pool, scope, listParams, { status: "PLANNED" }),
  },
  {
    name: "transfers.selectTransfers(hubId)",
    run: () => transfers.selectTransfers(pool, scope, listParams, { hubId: "1" }),
  },
  {
    name: "transfers.selectTransfers(vehicleId)",
    run: () => transfers.selectTransfers(pool, scope, listParams, { vehicleId: "1" }),
  },
  {
    name: "transfers.selectTransfers(driverId)",
    run: () => transfers.selectTransfers(pool, scope, listParams, { driverId: "1" }),
  },
  {
    name: "transfers.selectTransfers(search)",
    run: () => transfers.selectTransfers(pool, scope, listParams, { search: "a" }),
  },
  ...(["departedAt", "arrivedAt", "status", "createdAt"] as const).map((sortBy) => ({
    name: `transfers.selectTransfers(sortBy=${sortBy})`,
    run: () => transfers.selectTransfers(pool, scope, { ...listParams, sortBy }, {}),
  })),
  {
    name: "transfers.selectTransfers(branch-scoped)",
    run: () =>
      transfers.selectTransfers(
        pool,
        { ...scope, isCompanyWide: false, branchId: "1" },
        listParams,
        {},
      ),
  },
  {
    name: "transfers.selectTransfers(hub-scoped)",
    run: () =>
      transfers.selectTransfers(
        pool,
        { ...scope, isCompanyWide: false, hubIds: ["1"] },
        listParams,
        {},
      ),
  },
  {
    name: "transfers.selectTransfers(branch+hub-scoped)",
    run: () =>
      transfers.selectTransfers(
        pool,
        { ...scope, isCompanyWide: false, branchId: "1", hubIds: ["1"] },
        listParams,
        {},
      ),
  },
  {
    name: "transfers.selectTransferWithParcels",
    run: () => transfers.selectTransferWithParcels(pool, scope, "1"),
  },
  {
    name: "transfers.selectTransferWithParcels(branch-scoped)",
    run: () =>
      transfers.selectTransferWithParcels(
        pool,
        { ...scope, isCompanyWide: false, branchId: "1" },
        "1",
      ),
  },
  {
    name: "transfers.selectTransferWithParcels(hub-scoped)",
    run: () =>
      transfers.selectTransferWithParcels(
        pool,
        { ...scope, isCompanyWide: false, hubIds: ["1"] },
        "1",
      ),
  },
  {
    name: "transfers.selectTransferWithParcels(for update)",
    run: () => transfers.selectTransferWithParcels(pool, scope, "1", { forUpdate: true }),
  },
  {
    name: "transfers.selectTransferWithParcels(for update, hub-scoped)",
    run: () =>
      transfers.selectTransferWithParcels(
        pool,
        { ...scope, isCompanyWide: false, hubIds: ["1"] },
        "1",
        {
          forUpdate: true,
        },
      ),
  },
  {
    name: "transfers.selectTransferParcels",
    run: () => transfers.selectTransferParcels(pool, "1"),
  },
  {
    name: "transfers.selectManifestParcelIds",
    run: () => transfers.selectManifestParcelIds(pool, "1"),
  },
  { name: "transfers.countManifest", run: () => transfers.countManifest(pool, "1") },
  {
    name: "transfers.findManifestCandidates",
    run: () => transfers.findManifestCandidates(pool, "1", ["1", "2"]),
  },
  {
    name: "transfers.findManifestCandidates(empty)",
    run: () => transfers.findManifestCandidates(pool, "1", []),
  },
  {
    name: "transfers.findStaffByRef(email)",
    run: () => transfers.findStaffByRef(pool, "nobody@example.com"),
  },
  { name: "transfers.findHub", run: () => transfers.findHub(pool, "1") },
  { name: "transfers.findVehicle", run: () => transfers.findVehicle(pool, "1") },
  { name: "transfers.findRoute", run: () => transfers.findRoute(pool, "1") },
  // ---- deliveries -----------------------------------------------------------
  //
  // Scope comes from the attempt's own hub (`d.hub_id`), joined through
  // `scope_hub`. Each scoped case exercises the alias the company-wide case
  // never touches — the same class of bug Batch 6 fixed on parcels reads.
  {
    name: "deliveries.selectDeliveries",
    run: () => deliveries.selectDeliveries(pool, scope, listParams, {}),
  },
  {
    name: "deliveries.selectDeliveries(status)",
    run: () => deliveries.selectDeliveries(pool, scope, listParams, { status: "ASSIGNED" }),
  },
  {
    name: "deliveries.selectDeliveries(riderId)",
    run: () => deliveries.selectDeliveries(pool, scope, listParams, { riderId: "1" }),
  },
  {
    name: "deliveries.selectDeliveries(hubId)",
    run: () => deliveries.selectDeliveries(pool, scope, listParams, { hubId: "1" }),
  },
  {
    name: "deliveries.selectDeliveries(search)",
    run: () => deliveries.selectDeliveries(pool, scope, listParams, { search: "a" }),
  },
  ...(["assignedAt", "deliveredAt", "status", "createdAt"] as const).map((sortBy) => ({
    name: `deliveries.selectDeliveries(sortBy=${sortBy})`,
    run: () => deliveries.selectDeliveries(pool, scope, { ...listParams, sortBy }, {}),
  })),
  {
    name: "deliveries.selectDeliveries(branch-scoped)",
    run: () =>
      deliveries.selectDeliveries(
        pool,
        { ...scope, isCompanyWide: false, branchId: "1" },
        listParams,
        {},
      ),
  },
  {
    name: "deliveries.selectDeliveries(hub-scoped)",
    run: () =>
      deliveries.selectDeliveries(
        pool,
        { ...scope, isCompanyWide: false, hubIds: ["1"] },
        listParams,
        {},
      ),
  },
  { name: "deliveries.selectDelivery", run: () => deliveries.selectDelivery(pool, scope, "1") },
  {
    name: "deliveries.selectDelivery(branch-scoped)",
    run: () =>
      deliveries.selectDelivery(pool, { ...scope, isCompanyWide: false, branchId: "1" }, "1"),
  },
  {
    name: "deliveries.selectDelivery(hub-scoped)",
    run: () =>
      deliveries.selectDelivery(pool, { ...scope, isCompanyWide: false, hubIds: ["1"] }, "1"),
  },
  {
    name: "deliveries.selectDelivery(for update)",
    run: () => deliveries.selectDelivery(pool, scope, "1", { forUpdate: true }),
  },
  {
    name: "deliveries.selectDelivery(for update, hub-scoped)",
    run: () =>
      deliveries.selectDelivery(pool, { ...scope, isCompanyWide: false, hubIds: ["1"] }, "1", {
        forUpdate: true,
      }),
  },
  { name: "deliveries.countOpenAttempts", run: () => deliveries.countOpenAttempts(pool, "1") },
  { name: "deliveries.nextAttemptNo", run: () => deliveries.nextAttemptNo(pool, "1") },
  {
    name: "deliveries.parcelDispatchHub",
    run: () => deliveries.parcelDispatchHub(pool, scope, "1"),
  },
  {
    name: "deliveries.parcelDispatchHub(hub-scoped)",
    run: () =>
      deliveries.parcelDispatchHub(pool, { ...scope, isCompanyWide: false, hubIds: ["1"] }, "1"),
  },
  // ---- delivery-proofs --------------------------------------------------------
  //
  // Scope resolves through the attempt's hub: every clause names `scope_hub`,
  // which only exists because of the join spelled out in `PROOF_FROM`. A bare
  // `scope_hub` predicate would 500 for a scoped caller, so each scope
  // variant is exercised here.
  {
    name: "deliveryProofs.selectDeliveryProofs",
    run: () => deliveryProofs.selectDeliveryProofs(pool, scope, listParams, {}),
  },
  {
    name: "deliveryProofs.selectDeliveryProofs(type)",
    run: () => deliveryProofs.selectDeliveryProofs(pool, scope, listParams, { type: "OTP" }),
  },
  {
    name: "deliveryProofs.selectDeliveryProofs(verified)",
    run: () => deliveryProofs.selectDeliveryProofs(pool, scope, listParams, { verified: "false" }),
  },
  {
    name: "deliveryProofs.selectDeliveryProofs(deliveryId)",
    run: () => deliveryProofs.selectDeliveryProofs(pool, scope, listParams, { deliveryId: "1" }),
  },
  {
    name: "deliveryProofs.selectDeliveryProofs(search)",
    run: () => deliveryProofs.selectDeliveryProofs(pool, scope, listParams, { search: "a" }),
  },
  ...(["createdAt", "type"] as const).map((sortBy) => ({
    name: `deliveryProofs.selectDeliveryProofs(sortBy=${sortBy})`,
    run: () => deliveryProofs.selectDeliveryProofs(pool, scope, { ...listParams, sortBy }, {}),
  })),
  {
    name: "deliveryProofs.selectDeliveryProofs(branch-scoped)",
    run: () =>
      deliveryProofs.selectDeliveryProofs(
        pool,
        { ...scope, isCompanyWide: false, branchId: "1" },
        listParams,
        {},
      ),
  },
  {
    name: "deliveryProofs.selectDeliveryProofs(hub-scoped)",
    run: () =>
      deliveryProofs.selectDeliveryProofs(
        pool,
        { ...scope, isCompanyWide: false, hubIds: ["1"] },
        listParams,
        {},
      ),
  },
  {
    name: "deliveryProofs.selectDeliveryProof",
    run: () => deliveryProofs.selectDeliveryProof(pool, scope, "1"),
  },
  {
    name: "deliveryProofs.selectDeliveryProof(hub-scoped)",
    run: () =>
      deliveryProofs.selectDeliveryProof(
        pool,
        { ...scope, isCompanyWide: false, hubIds: ["1"] },
        "1",
      ),
  },
  {
    name: "deliveryProofs.selectDeliveryProof(for update)",
    run: () => deliveryProofs.selectDeliveryProof(pool, scope, "1", { forUpdate: true }),
  },
  {
    name: "deliveryProofs.selectDeliveryProofById",
    run: () => deliveryProofs.selectDeliveryProofById(pool, "1"),
  },
  {
    name: "deliveryProofs.selectProofsForParcelAndRider",
    run: () => deliveryProofs.selectProofsForParcelAndRider(pool, "1", "1"),
  },
  {
    name: "deliveryProofs.selectAttemptForProof",
    run: () => deliveryProofs.selectAttemptForProof(pool, "1", "1"),
  },

  { name: "users.selectUsers", run: () => users.selectUsers(pool, scope, listParams, {}) },
  {
    name: "users.selectUsers(status)",
    run: () => users.selectUsers(pool, scope, listParams, { status: "ACTIVE" }),
  },
  {
    name: "users.selectUsers(branchId)",
    run: () => users.selectUsers(pool, scope, listParams, { branchId: "1" }),
  },
  {
    name: "users.selectUsers(search)",
    run: () => users.selectUsers(pool, scope, listParams, { search: "admin" }),
  },
  ...(["name", "email", "status", "createdAt"] as const).map((sortBy) => ({
    name: `users.selectUsers(sortBy=${sortBy})`,
    run: () => users.selectUsers(pool, scope, { ...listParams, sortBy }, {}),
  })),
  {
    name: "users.selectUsers(branch-scoped)",
    run: () =>
      users.selectUsers(pool, { ...scope, isCompanyWide: false, branchId: "1" }, listParams, {}),
  },
  {
    name: "users.selectUsers(hub-scoped)",
    run: () =>
      users.selectUsers(pool, { ...scope, isCompanyWide: false, hubIds: ["1"] }, listParams, {}),
  },
  { name: "users.selectUser", run: () => users.selectUser(pool, scope, "1") },
  {
    name: "users.selectUser(branch-scoped)",
    run: () => users.selectUser(pool, { ...scope, isCompanyWide: false, branchId: "1" }, "1"),
  },
  { name: "users.selectUserRoles", run: () => users.selectUserRoles(pool, ["1"]) },
  { name: "users.selectUserRoles(empty)", run: () => users.selectUserRoles(pool, []) },
  { name: "users.selectUserHubs", run: () => users.selectUserHubs(pool, ["1"]) },
  { name: "users.selectRoleIdsForUser", run: () => users.selectRoleIdsForUser(pool, "1") },
  { name: "users.selectRoleIdByName", run: () => users.selectRoleIdByName(pool, "ADMIN") },
  {
    name: "users.countActiveAdminsExcluding",
    run: () => users.countActiveAdminsExcluding(pool, "1"),
  },
  {
    name: "users.selectExistingIds(roles)",
    run: () => users.selectExistingIds(pool, "roles", ["1"]),
  },
  {
    name: "users.selectExistingIds(hubs)",
    run: () => users.selectExistingIds(pool, "hubs", ["1"]),
  },
  {
    name: "users.selectExistingIds(branches)",
    run: () => users.selectExistingIds(pool, "branches", ["1"]),
  },

  { name: "roles.selectRoles", run: () => roles.selectRoles(pool, listParams, {}) },
  {
    name: "roles.selectRoles(search)",
    run: () => roles.selectRoles(pool, listParams, { search: "admin" }),
  },
  ...(["name", "createdAt"] as const).map((sortBy) => ({
    name: `roles.selectRoles(sortBy=${sortBy})`,
    run: () => roles.selectRoles(pool, { ...listParams, sortBy }, {}),
  })),
  { name: "roles.selectRole", run: () => roles.selectRole(pool, "1") },
  { name: "roles.selectRolePermissions", run: () => roles.selectRolePermissions(pool, "1") },
  {
    name: "roles.countActiveHoldersExcludingRole",
    run: () => roles.countActiveHoldersExcludingRole(pool, "users.manage", "1"),
  },

  // --- Customers (Batch 3) ---------------------------------------------------
  // Company-wide, so there is no scoped variant to exercise — but the filters
  // and every sort key still are: `status` puts a column in the count WHERE,
  // `search` exercises the LIKE clauses, and each sort key proves the published
  // allowlist maps to a column the schema actually has.
  { name: "customers.selectCustomers", run: () => customers.selectCustomers(pool, listParams, {}) },
  {
    name: "customers.selectCustomers(status)",
    run: () => customers.selectCustomers(pool, listParams, { status: "TEMP" }),
  },
  {
    name: "customers.selectCustomers(search)",
    run: () => customers.selectCustomers(pool, listParams, { search: "a%" }),
  },
  {
    name: "customers.selectCustomers(status+search)",
    run: () => customers.selectCustomers(pool, listParams, { status: "ACTIVE", search: "a" }),
  },
  ...(["name", "phone", "status", "createdAt"] as const).map((sortBy) => ({
    name: `customers.selectCustomers(sortBy=${sortBy})`,
    run: () => customers.selectCustomers(pool, { ...listParams, sortBy }, {}),
  })),
  {
    name: "customers.selectCustomers(status+search+sortBy)",
    run: () =>
      customers.selectCustomers(
        pool,
        { ...listParams, sortBy: "name", sort: "desc" as const },
        { status: "TEMP", search: "a" },
      ),
  },
  { name: "customers.selectCustomer", run: () => customers.selectCustomer(pool, "1") },
  {
    name: "customers.selectCustomerAddresses",
    run: () => customers.selectCustomerAddresses(pool, "1"),
  },

  // Payments join `parcels`, so they exercise both tables; the status filter
  // puts a column in the count WHERE too. Every published sort key is checked
  // the same way the customers block does it.
  { name: "payments.selectPayments", run: () => payments.selectPayments(pool, listParams, {}) },
  {
    name: "payments.selectPayments(status)",
    run: () => payments.selectPayments(pool, listParams, { status: "PAID" }),
  },
  ...(["createdAt", "paidAt", "amount", "status"] as const).map((sortBy) => ({
    name: `payments.selectPayments(sortBy=${sortBy})`,
    run: () => payments.selectPayments(pool, { ...listParams, sortBy }, {}),
  })),
  { name: "payments.selectPayment", run: () => payments.selectPayment(pool, "1") },
  {
    name: "payments.selectParcelPaymentFacts",
    run: () => payments.selectParcelPaymentFacts(pool, "1", false),
  },
  { name: "payments.sumTypedPaid(COD)", run: () => payments.sumTypedPaid(pool, "1", "COD") },
  { name: "payments.sumTypedPaid(REFUND)", run: () => payments.sumTypedPaid(pool, "1", "REFUND") },

  // Settlements join `customers` (identity on every row) and `parcels`
  // (aggregation), and the filter puts a status column in the count WHERE.
  // `lockCustomerForSettlement` is a SELECT ... FOR UPDATE — fine to run;
  // outside an explicit transaction the lock is a no-op.
  {
    name: "settlements.selectSettlements",
    run: () => settlements.selectSettlements(pool, listParams, {}),
  },
  {
    name: "settlements.selectSettlements(status)",
    run: () => settlements.selectSettlements(pool, listParams, { status: "PENDING" }),
  },
  ...(["createdAt", "periodStart", "periodEnd", "totalCod", "netAmount", "status"] as const).map(
    (sortBy) => ({
      name: `settlements.selectSettlements(sortBy=${sortBy})`,
      run: () => settlements.selectSettlements(pool, { ...listParams, sortBy }, {}),
    }),
  ),
  { name: "settlements.selectSettlement", run: () => settlements.selectSettlement(pool, "1") },
  {
    name: "settlements.selectCustomerSettlementTotals",
    run: () => settlements.selectCustomerSettlementTotals(pool, "1", "2026-01-01", "2026-01-31"),
  },
  {
    name: "settlements.lockCustomerForSettlement",
    run: () => settlements.lockCustomerForSettlement(pool, "1"),
  },
  {
    name: "settlements.settlementPeriodExists",
    run: () => settlements.settlementPeriodExists(pool, "1", "2026-01-01", "2026-01-31"),
  },
)

let failures = 0
for (const c of cases) {
  try {
    const result = await c.run()
    const size = Array.isArray(result) ? result.length : result === null ? "null" : "row"
    console.log(`  ok    ${c.name} -> ${size}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // A business rejection means the SQL was valid and the (empty) database had
    // nothing to return -- that is the expected outcome, not a schema failure.
    if (error instanceof DomainError) {
      console.log(`  ok    ${c.name} -> rejected: ${error.code}`)
      continue
    }
    failures += 1
    console.log(`  FAIL  ${c.name} -> ${message}`)
  }
}

console.log(`\n${cases.length - failures}/${cases.length} read paths conform to the schema`)
await closePool(pool)
process.exit(failures === 0 ? 0 : 1)
