/**
 * Temporary read-only schema conformance check.
 *
 * The database is schema-only, so no read path has ever actually executed. This
 * exercises every SELECT against the real schema: a valid query returns empty
 * results, while a bad column or table reference throws a DatabaseError. Writes
 * are not exercised, and nothing here mutates data.
 */
import { getDatabase, closeDatabase, type ListParams } from "@dropx/db"

import { DomainError } from "../src/core"
import type { Scope } from "../src/shared/auth/auth-context"

const db = getDatabase()

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

const scope: Scope = {
  userId: "1",
  branchId: null,
  hubIds: [],
  isCompanyWide: true,
}
const listParams: ListParams = { page: 1, limit: 10, offset: 0, sort: "desc" }
const sortColumns = ["p.created_at", "p.status", "p.tracking_number"] as const

cases.push(
  {
    name: "tracking.findByTrackingNumber",
    run: () => track.trackingRepository.findByTrackingNumber(db, "DX-TEST-0001"),
  },
  { name: "tracking.findEvents", run: () => track.trackingRepository.findEvents(db, "1") },

  {
    name: "jobs.listJobsForRider",
    run: () => jobs.listJobsForRider(db, "1", listParams, undefined, undefined),
  },
  {
    name: "jobs.listJobsForRider(status)",
    run: () => jobs.listJobsForRider(db, "1", listParams, "ASSIGNED", undefined),
  },
  { name: "jobs.findJobForRider", run: () => jobs.findJobForRider(db, "1", "1") },
  { name: "jobs.listJobItems", run: () => jobs.listJobItems(db, "1") },
  { name: "jobs.findOpenAttemptForUpdate", run: () => jobs.findOpenAttemptForUpdate(db, "1", "1") },

  {
    name: "parcels.listParcels",
    run: () => parcels.listParcels(db, scope, listParams, {}, sortColumns),
  },
  {
    name: "parcels.listParcels(filtered)",
    run: () =>
      parcels.listParcels(
        db,
        scope,
        { ...listParams, sortBy: "p.created_at" },
        { status: "CREATED", search: "DX", hubId: "1", paymentType: "COD" },
        sortColumns,
      ),
  },
  { name: "parcels.findParcelById", run: () => parcels.findParcelById(db, scope, "1") },
  {
    name: "parcels.findParcelByTrackingNumber",
    run: () => parcels.findParcelByTrackingNumber(db, "DX-TEST-0001"),
  },
  {
    name: "parcels.listParcelsForCustomer",
    run: () => parcels.listParcelsForCustomer(db, "1", listParams, {}, sortColumns),
  },
  { name: "parcels.findParcelForCustomer", run: () => parcels.findParcelForCustomer(db, "1", "1") },
  { name: "parcels.listParcelItems", run: () => parcels.listParcelItems(db, "1") },

  {
    name: "auth.findUserByEmail",
    run: () => auth.authRepository.findUserByEmail(db, "nobody@example.com"),
  },
  { name: "auth.findRiderByUserId", run: () => auth.authRepository.findRiderByUserId(db, "1") },
  {
    name: "auth.findCustomerByIdentifier",
    run: () => auth.authRepository.findCustomerByIdentifier(db, "nobody@example.com"),
  },
  { name: "auth.findCustomerById", run: () => auth.authRepository.findCustomerById(db, "1") },

  { name: "actor.loadStaffActor", run: () => actors.loadStaffActor(db, "1") },
  { name: "actor.loadRiderActor", run: () => actors.loadRiderActor(db, "1") },
  { name: "actor.loadCustomerActor", run: () => actors.loadCustomerActor(db, "1") },

  {
    name: "pricing.quoteDeliveryFee",
    run: () =>
      pricing.quoteDeliveryFee({
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
      pricing.quoteDeliveryFee({
        originZoneId: "1",
        destinationZoneId: "2",
        weightKg: 0.5,
        codAmount: 0,
      }),
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
await closeDatabase()
process.exit(failures === 0 ? 0 : 1)
