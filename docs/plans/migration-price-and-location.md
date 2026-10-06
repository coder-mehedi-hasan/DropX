# DropX Pathao-Style Location, Address, and Pricing Migration Plan

## Goal

Replace the current flat address and zone system with:

    City
     └── Zone
          └── Area
               └── Address line

Use the hierarchy for both pickup and delivery. Calculate pricing from pickup service type, delivery service type, same-city/different-city relationship, weight slab, and COD fees.

This is a staged migration. Existing parcels, tracking, delivery assignments, hubs, riders, COD, and settlements must continue working until every consumer moves to the new contract.

## Current state and target state

The current system has:

- A flat `zones` table.
- Parcel-level `origin_zone_id` and `destination_zone_id`.
- One free-text `receiver_address`.
- Pricing based on origin zone, destination zone, and kilogram weight ranges.
- Hubs used operationally without a customer-facing city/zone/area hierarchy.

The target system separates:

    Location system = customer territory, address selection, and pricing
    Hub system      = internal sorting, transfer, dispatch, and delivery operations

Hubs must not be used as customer-facing cities.

## Phase 1 — Build the location hierarchy

Add these tables to `apps/api/src/db/migrate.sql`.

### service_cities

Fields:

- `id`
- `name`
- `code`
- `service_type`: `ISD`, `SUBURB`, or `OSD`
- `status`
- `created_at`
- `updated_at`

Examples: Dhaka (`ISD`), Savar (`SUBURB`), Bagerhat (`OSD`).

### service_zones

Fields:

- `id`
- `city_id`
- `name`
- `code`
- `status`
- timestamps

Examples: Dhaka → Dhanmondi; Bagerhat → Bagerhat Sadar.

### service_areas

Fields:

- `id`
- `zone_id`
- `name`
- `code`
- `status`
- timestamps

Examples: Bagerhat Sadar → Badamtola; Bagerhat Sadar → Bagerhat Stadium.

Deactivate locations instead of deleting them. Historical parcels must remain valid. Keep the existing `zones` table during migration as a compatibility layer.

## Phase 2 — Add structured parcel addresses

Create a `parcel_addresses` table with:

- `id`
- `parcel_id`
- `type`: `PICKUP` or `DELIVERY`
- `city_id`
- `zone_id`
- nullable `area_id`
- city, zone, and area name snapshots
- `address_line`
- nullable `landmark`
- nullable `latitude` and `longitude`
- timestamps

Each parcel gets one pickup and one delivery address. Store name snapshots so old parcels do not change when an administrator renames a location.

Temporarily keep and write:

- `receiver_address`
- `origin_zone_id`
- `destination_zone_id`

Stop writing them only after all consumers migrate.

## Phase 3 — Replace the booking address design

Booking flow:

1. Sender details
2. Pickup location
3. Delivery location
4. Parcel details
5. Payment
6. Review

Pickup and delivery cards should contain:

- City select
- Zone select filtered by city
- Optional area chips filtered by zone
- Address line textarea
- Optional landmark
- Optional map coordinates later

Layout idea:

- Treat pickup and delivery as two clearly separated address sections with matching structure.
- Use a location icon, short section title, and supporting helper text at the top of each section.
- Group city, zone, and area controls together because they form one location-selection workflow.
- Place the address line and landmark fields after the location selectors so users understand the territory before entering detailed directions.
- Use a two-column arrangement for pickup and delivery on wide screens, and stack the sections on small screens.
- Show selected city and zone as removable chips after selection.
- Show areas as compact selectable chips with search and an `Other area` option.
- Keep address fields visually quieter than the location selectors so the hierarchy is clear.
- Use the existing DropX tokens, visible focus states, and responsive form components rather than introducing a separate visual system.

Cascading behavior:

    City selected → load zones
    Zone selected → load areas
    Area selected optionally → enter address

Rules:

- Changing city clears zone and area.
- Changing zone clears area.
- Inactive locations are hidden from customers.
- City and zone cannot be manually typed.
- The API validates every parent-child relationship.

Remove the temporary free-text `receiverCity` and `receiverArea` fields when this phase is implemented.

## Phase 4 — Add location APIs

Customer reference APIs:

- `GET /api/v1/customer/locations/cities`
- `GET /api/v1/customer/locations/cities/:cityId/zones`
- `GET /api/v1/customer/locations/zones/:zoneId/areas`

Admin APIs:

- `GET/POST/PATCH /api/v1/admin/service-cities`
- `GET/POST/PATCH /api/v1/admin/service-zones`
- `GET/POST/PATCH /api/v1/admin/service-areas`

Every route needs Zod request/response schemas, policy registration, OpenAPI coverage, active filtering, pagination for admin, search, and parent validation.

## Phase 5 — Replace the pricing model

Replace pricing based on:

    originZoneId + destinationZoneId + minWeight + maxWeight

with `pricing_lanes` and `pricing_slabs`.

### pricing_lanes

A lane contains:

- `pickup_type`
- `delivery_type`
- `same_city`
- `status`

Initial lanes:

- ISD → ISD
- ISD → SUBURB
- ISD → OSD
- SUBURB → SAME_CITY
- SUBURB → ISD
- SUBURB → DIFFERENT_CITY
- SUBURB → OSD
- OSD → SAME_CITY
- OSD → ISD
- OSD → SUBURB
- OSD → DIFFERENT_CITY
- ISD_ON_DEMAND → SAME_CITY_ON_DEMAND

### pricing_slabs

Fields:

- `pricing_lane_id`
- `min_weight_grams`
- `max_weight_grams`
- `base_fee`
- `extra_kg_fee`
- `cod_percentage`
- `cod_fixed_fee`
- `status`

Use non-overlapping slabs:

- 0–200g
- 201–500g
- 501g–1kg
- 1kg–2kg

The supplied image overlaps 0–200g and 0–500g. Normalize the second slab to 201–500g and reject overlapping slabs in the database and admin UI.

## Phase 6 — Seed the initial pricing matrix

| Pickup | Delivery | 0–200g | 201–500g | 501g–1kg | 1–2kg |
|---|---|---:|---:|---:|---:|
| ISD | ISD | 60 | 60 | 70 | 90 |
| ISD | Suburb | 80 | 80 | 100 | 130 |
| ISD | OSD | 110 | 110 | 130 | 170 |
| Suburb | Same city | 60 | 60 | 70 | 90 |
| Suburb | ISD | 80 | 80 | 100 | 130 |
| Suburb | Different city | 80 | 80 | 100 | 130 |
| Suburb | OSD | 110 | 110 | 130 | 170 |
| OSD | Same city | 60 | 60 | 70 | 90 |
| OSD | ISD | 110 | 110 | 130 | 170 |
| OSD | Suburb | 110 | 110 | 130 | 170 |
| OSD | Different city | 120 | 120 | 145 | 180 |
| ISD On Demand | Same city on demand | 120 | 120 | 150 | 150 |

For parcels above 2kg, configure an explicit extra-weight rule. Do not silently reuse the current `price_per_kg` behavior.

## Phase 7 — Replace the quote contract

Replace the current quote request with:

    {
      pickupCityId,
      pickupZoneId,
      deliveryCityId,
      deliveryZoneId,
      weightGrams,
      codAmount
    }

The server must:

1. Validate city/zone relationships.
2. Load pickup and delivery service types.
3. Determine same-city or different-city.
4. Select exactly one pricing lane.
5. Select exactly one weight slab.
6. Add COD fees.
7. Add extra-weight fees.
8. Return a fee breakdown.

Example display:

    Base delivery fee     ৳130
    COD fee               ৳20
    Extra weight fee      ৳0
    Estimated total       ৳150

The client must never calculate the final price.

## Phase 8 — Update the parcel contract

Target address input:

    type ParcelAddressInput = {
      cityId: string
      zoneId: string
      areaId?: string
      addressLine: string
      landmark?: string
      latitude?: number
      longitude?: number
    }

Target parcel request:

    {
      pickupAddress: ParcelAddressInput
      deliveryAddress: ParcelAddressInput
      receiver, parcel, payment, and item fields
    }

The service validates relationships and persists structured records plus snapshots. Routes remain thin and repositories remain responsible for SQL only.

## Phase 9 — Redesign the admin portal

Replace:

    Zones
    Pricing Rules

with:

    Locations
     ├── Cities
     ├── Zones
     └── Areas

    Pricing
     ├── Pricing Matrix
     ├── Weight Slabs
     └── COD Settings

Admin can create and edit locations, assign service types, activate/deactivate locations, edit matrix values, configure COD and extra-weight fees, and manage non-overlapping slabs.

## Phase 10 — Update every application

### Web

Update booking, saved addresses, fee quote, review, and address display.

### Admin

Update parcel creation, parcel detail, pricing, location management, and reports.

### Riders

Update pickup address, delivery address, area, landmark, and job display.

### API and shared types

Update parcel DTOs, repositories, services, tracking, delivery projections, quote service, OpenAPI, and `packages/types`.

## Phase 11 — Remove legacy systems

Do not remove legacy fields at the beginning.

### Remove from frontend

- Free-text `receiverCity`
- Free-text `receiverArea`
- Flat `destinationZoneId` booking field
- Single `receiverAddress`-only flow
- Static/manual area suggestions

### Remove from API

- `receiverAddress` as the primary address source
- Zone-only location input
- Old quote request shape

### Remove from pricing

- Direct origin-zone/destination-zone lookup
- Overlapping kilogram ranges
- Kilogram-only slab selection
- `price_per_kg`-only pricing
- Unused express pricing

### Remove from database later

- Old flat `zones` table
- Legacy `pricing_rules` table
- Legacy parcel address columns
- Legacy parcel origin/destination zone columns

Do not remove branches, hubs, routes, riders, deliveries, COD, or settlements.

## Phase 12 — Migration order

1. Add location tables.
2. Seed cities, zones, and areas.
3. Add structured parcel addresses.
4. Add location reference APIs.
5. Add admin location management.
6. Add pricing lanes and slabs.
7. Seed the pricing matrix.
8. Add the new quote contract.
9. Update customer booking.
10. Update admin parcel and pricing screens.
11. Update rider, tracking, and delivery projections.
12. Backfill old parcels where mappings are known.
13. Stop writing new legacy fields.
14. Monitor old-field reads.
15. Remove legacy tables and columns in a later migration.

## Phase 13 — Documentation and verification

Update:

- `docs/overview.md`
- `docs/er-diagram.md`
- `docs/rbac.md`
- `apps/api/src/db/migrate.sql`
- `packages/types/src/index.ts`

Add tests for:

- City → zone filtering.
- Zone → area filtering.
- Invalid city/zone combinations.
- Invalid zone/area combinations.
- Same-city pricing.
- Different-city pricing.
- Every pricing matrix row.
- Every weight slab.
- COD fee calculation.
- Extra-weight calculation.
- Historical location snapshots.
- Inactive locations hidden from customers.
- Legacy parcels displaying correctly.
- No overlapping slabs.
- Server-side fee recalculation during parcel creation.

The migration is complete when the new location and pricing systems are the only systems used for booking, quoting, parcel creation, tracking, rider jobs, and admin operations.
