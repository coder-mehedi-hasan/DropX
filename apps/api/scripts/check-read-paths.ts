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
const zones = await import("../src/modules/zones/zones.repository")
const vehicles = await import("../src/modules/vehicles/vehicles.repository")
const pricingRules = await import("../src/modules/pricing/pricing-rules.repository")
const routes = await import("../src/modules/routes/routes.repository")
const riders = await import("../src/modules/riders/riders.repository")
const riderLocations = await import("../src/modules/riders/rider-locations.repository")

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
        { status: "CREATED", search: "DX", hubId: "1", paymentType: "COD" },
        parcelSortByKey,
      ),
  },
  ...(["createdAt", "updatedAt", "trackingNumber", "status", "weight"] as const).map((sortBy) => ({
    name: `parcels.listParcels(sortBy=${sortBy})`,
    run: () => parcels.listParcels(pool, scope, { ...listParams, sortBy }, {}, parcelSortByKey),
  })),
  { name: "parcels.findParcelById", run: () => parcels.findParcelById(pool, scope, "1") },
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
  { name: "reference.listZoneRefs", run: () => reference.listZoneRefs(pool, listParams, {}) },
  {
    name: "reference.listZoneRefs(search)",
    run: () => reference.listZoneRefs(pool, listParams, { search: "a" }),
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
  ...(["name", "code", "status"] as const).map((sortBy) => ({
    name: `reference.listZoneRefs(sortBy=${sortBy})`,
    run: () => reference.listZoneRefs(pool, { ...listParams, sortBy }, {}),
  })),
  ...(["name", "phone", "createdAt"] as const).map((sortBy) => ({
    name: `reference.searchCustomerRefs(sortBy=${sortBy})`,
    run: () => reference.searchCustomerRefs(pool, { ...listParams, sortBy }, {}),
  })),

  {
    name: "pricing.quoteDeliveryFee",
    run: () =>
      pricing.quoteDeliveryFee(ctx, {
        originZoneId: "1",
        destinationZoneId: "2",
        weightKg: 2.5,
        codAmount: 1000,
        express: true,
      }),
  },
  {
    name: "pricing.quoteDeliveryFee(prepaid)",
    run: () =>
      pricing.quoteDeliveryFee(ctx, {
        originZoneId: "1",
        destinationZoneId: "2",
        weightKg: 0.5,
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

  // --- Network: zones --------------------------------------------------------
  //
  // The filters are exercised too, not just the unfiltered list: each filter
  // adds a clause, and a clause naming a column the FROM clause did not alias is
  // a 500 that an unfiltered run never sees.
  { name: "zones.selectZones", run: () => zones.selectZones(pool, listParams, {}) },
  {
    name: "zones.selectZones(status)",
    run: () => zones.selectZones(pool, listParams, { status: "ACTIVE" }),
  },
  {
    name: "zones.selectZones(search)",
    run: () => zones.selectZones(pool, listParams, { search: "100%" }),
  },
  ...(["name", "code", "status", "createdAt"] as const).map((sortBy) => ({
    name: `zones.selectZones(sortBy=${sortBy})`,
    run: () => zones.selectZones(pool, { ...listParams, sortBy }, {}),
  })),
  // A filter and a sort in the same query. Neither alone is enough: the filter is
  // what puts an aliased column in the count query's WHERE, and the sort is what
  // puts an aliased column in ORDER BY, so running them separately leaves the exact
  // query a user produces by typing in the search box *and* clicking a column header
  // unexercised.
  ...(["name", "code", "status", "createdAt"] as const).map((sortBy) => ({
    name: `zones.selectZones(status+search+sortBy=${sortBy})`,
    run: () =>
      zones.selectZones(
        pool,
        { ...listParams, sortBy, sort: "desc" as const },
        {
          status: "ACTIVE",
          search: "100%",
        },
      ),
  })),
  { name: "zones.selectZone", run: () => zones.selectZone(pool, "1") },

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

  // --- Pricing rules ---------------------------------------------------------
  {
    name: "pricingRules.selectPricingRules",
    run: () => pricingRules.selectPricingRules(pool, listParams, {}),
  },
  {
    name: "pricingRules.selectPricingRules(status)",
    run: () => pricingRules.selectPricingRules(pool, listParams, { status: "ACTIVE" }),
  },
  {
    name: "pricingRules.selectPricingRules(search)",
    run: () => pricingRules.selectPricingRules(pool, listParams, { search: "DHAKA" }),
  },
  ...(["name", "originZone", "destinationZone", "minWeight", "createdAt"] as const).map(
    (sortBy) => ({
      name: `pricingRules.selectPricingRules(sortBy=${sortBy})`,
      run: () => pricingRules.selectPricingRules(pool, { ...listParams, sortBy }, {}),
    }),
  ),
  { name: "pricingRules.selectPricingRule", run: () => pricingRules.selectPricingRule(pool, "1") },

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
