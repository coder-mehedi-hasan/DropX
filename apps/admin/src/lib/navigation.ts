import { z } from "zod"
import {
  DEFAULT_BRANCHES_SEARCH,
  DEFAULT_HUBS_SEARCH,
  branchesSearchSchema,
  hubsSearchSchema,
} from "@/routes/org-search-params"
import { DEFAULT_PARCELS_SEARCH } from "./parcels"
import { parcelsSearchSchema } from "@/routes/search-params"
import {
  DEFAULT_VEHICLES_SEARCH_PARAMS,
  vehiclesSearchSchema,
} from "@/routes/vehicles-search-params"
import { DEFAULT_ZONES_SEARCH_PARAMS, zonesSearchSchema } from "@/routes/zones-search-params"
import {
  DEFAULT_PRICING_RULES_SEARCH_PARAMS,
  pricingRulesSearchSchema,
} from "@/routes/pricing-rules-search-params"
import type { BranchesSearch, HubsSearch } from "@/routes/org-search-params"
import { DEFAULT_USERS_SEARCH_PARAMS, usersSearchSchema } from "@/routes/users-search-params"
import type { UsersSearch } from "@/routes/users-search-params"
import { DEFAULT_ROLES_SEARCH_PARAMS, rolesSearchSchema } from "@/routes/roles-search-params"
import type { RolesSearch } from "@/routes/roles-search-params"
import type { VehiclesSearch } from "@/routes/vehicles-search-params"
import type { ZonesSearch } from "@/routes/zones-search-params"
import type { RoutesSearch } from "@/routes/routes-search-params"
import type { RidersSearch } from "@/routes/riders-search-params"
import type { PricingRulesSearch } from "@/routes/pricing-rules-search-params"
import { DEFAULT_ROUTES_SEARCH_PARAMS, routesSearchSchema } from "@/routes/routes-search-params"
import { DEFAULT_RIDERS_SEARCH_PARAMS, ridersSearchSchema } from "@/routes/riders-search-params"
import type { RiderLocationsSearch } from "@/routes/rider-locations-search-params"
import {
  DEFAULT_RIDER_LOCATIONS_SEARCH_PARAMS,
  riderLocationsSearchSchema,
} from "@/routes/rider-locations-search-params"
import { DEFAULT_PICKUPS_SEARCH_PARAMS, pickupsSearchSchema } from "@/routes/pickups-search-params"
import type { PickupsSearch } from "@/routes/pickups-search-params"
import {
  DEFAULT_TRANSFERS_SEARCH_PARAMS,
  transfersSearchSchema,
} from "@/routes/transfers-search-params"
import type { TransfersSearch } from "@/routes/transfers-search-params"
import {
  DEFAULT_DELIVERIES_SEARCH_PARAMS,
  deliveriesSearchSchema,
} from "@/routes/deliveries-search-params"
import type { DeliveriesSearch } from "@/routes/deliveries-search-params"
import {
  DEFAULT_DELIVERY_PROOFS_SEARCH_PARAMS,
  deliveryProofsSearchSchema,
} from "@/routes/delivery-proofs-search-params"
import type { DeliveryProofsSearch } from "@/routes/delivery-proofs-search-params"
import {
  DEFAULT_CUSTOMERS_SEARCH_PARAMS,
  customersSearchSchema,
} from "@/routes/customers-search-params"
import type { CustomersSearch } from "@/routes/customers-search-params"
import {
  DEFAULT_PAYMENTS_SEARCH_PARAMS,
  paymentsSearchSchema,
} from "@/routes/payments-search-params"
import type { PaymentsSearch } from "@/routes/payments-search-params"

/**
 * Where a signed-in user may be sent after login.
 *
 * The router is declared in code, so `navigate({ to })` only accepts a known
 * route id — an arbitrary `redirect` string from the URL cannot be handed to it
 * unchecked. Resolving the path here keeps the login screen's "return me where I
 * was" behaviour without either a cast or an open-redirect: a path that is not
 * one of these falls back to the dashboard.
 *
 * Every list screen is listed here, because a redirect that silently drops a
 * user on the dashboard instead of the page they asked for is indistinguishable
 * from the redirect not working at all.
 */
export type AdminDestination =
  | { to: "/" }
  | { to: "/parcels"; search: ReturnType<typeof resolveParcelSearch> }
  | { to: "/parcels/$parcelId"; params: { parcelId: string } }
  | { to: "/tracking"; search: { tracking: string } }
  | { to: "/branches"; search: BranchesSearch }
  | { to: "/hubs"; search: HubsSearch }
  | { to: "/users"; search: UsersSearch }
  | { to: "/roles"; search: RolesSearch }
  | { to: "/customers"; search: CustomersSearch }
  | { to: "/customers/$customerId"; params: { customerId: string } }
  | { to: "/payments"; search: PaymentsSearch }
  | { to: "/zones"; search: ZonesSearch }
  | { to: "/vehicles"; search: VehiclesSearch }
  | { to: "/pricing-rules"; search: PricingRulesSearch }
  | { to: "/routes"; search: RoutesSearch }
  | { to: "/riders"; search: RidersSearch }
  | { to: "/rider-locations"; search: RiderLocationsSearch }
  | { to: "/pickups"; search: PickupsSearch }
  | { to: "/transfers"; search: TransfersSearch }
  | { to: "/deliveries"; search: DeliveriesSearch }
  | { to: "/delivery-proofs"; search: DeliveryProofsSearch }

const PARCEL_ID = /^[A-Za-z0-9_-]{1,64}$/

export function resolveRedirect(raw: string | undefined): AdminDestination {
  if (!raw || !raw.startsWith("/")) return { to: "/" }

  const url = new URL(raw, "http://admin.invalid")
  const path = url.pathname

  if (path === "/") return { to: "/" }

  if (path === "/parcels") {
    return { to: "/parcels", search: resolveParcelSearch(url.searchParams) }
  }

  if (path.startsWith("/parcels/")) {
    const parcelId = decodeURIComponent(path.slice("/parcels/".length))
    if (PARCEL_ID.test(parcelId)) return { to: "/parcels/$parcelId", params: { parcelId } }
    return { to: "/" }
  }

  if (path === "/tracking") {
    const tracking = url.searchParams.get("tracking")?.trim() ?? ""
    return tracking
      ? { to: "/tracking", search: { tracking } }
      : { to: "/tracking", search: { tracking: "" } }
  }

  if (path === "/branches") {
    return {
      to: "/branches",
      search: resolveListSearch(branchesSearchSchema, DEFAULT_BRANCHES_SEARCH, url.searchParams),
    }
  }

  if (path === "/hubs") {
    return {
      to: "/hubs",
      search: resolveListSearch(hubsSearchSchema, DEFAULT_HUBS_SEARCH, url.searchParams),
    }
  }

  if (path === "/users") {
    return {
      to: "/users",
      search: resolveListSearch(usersSearchSchema, DEFAULT_USERS_SEARCH_PARAMS, url.searchParams),
    }
  }

  if (path === "/roles") {
    return {
      to: "/roles",
      search: resolveListSearch(rolesSearchSchema, DEFAULT_ROLES_SEARCH_PARAMS, url.searchParams),
    }
  }

  if (path === "/customers") {
    return {
      to: "/customers",
      search: resolveListSearch(
        customersSearchSchema,
        DEFAULT_CUSTOMERS_SEARCH_PARAMS,
        url.searchParams,
      ),
    }
  }

  if (path.startsWith("/customers/")) {
    const customerId = decodeURIComponent(path.slice("/customers/".length))
    if (PARCEL_ID.test(customerId)) {
      return { to: "/customers/$customerId", params: { customerId } }
    }
    return { to: "/" }
  }

  if (path === "/payments") {
    return {
      to: "/payments",
      search: resolveListSearch(
        paymentsSearchSchema,
        DEFAULT_PAYMENTS_SEARCH_PARAMS,
        url.searchParams,
      ),
    }
  }

  if (path === "/zones") {
    return {
      to: "/zones",
      search: resolveListSearch(zonesSearchSchema, DEFAULT_ZONES_SEARCH_PARAMS, url.searchParams),
    }
  }

  if (path === "/vehicles") {
    return {
      to: "/vehicles",
      search: resolveListSearch(
        vehiclesSearchSchema,
        DEFAULT_VEHICLES_SEARCH_PARAMS,
        url.searchParams,
      ),
    }
  }

  if (path === "/pricing-rules") {
    return {
      to: "/pricing-rules",
      search: resolveListSearch(
        pricingRulesSearchSchema,
        DEFAULT_PRICING_RULES_SEARCH_PARAMS,
        url.searchParams,
      ),
    }
  }

  if (path === "/routes") {
    return {
      to: "/routes",
      search: resolveListSearch(routesSearchSchema, DEFAULT_ROUTES_SEARCH_PARAMS, url.searchParams),
    }
  }

  if (path === "/riders") {
    return {
      to: "/riders",
      search: resolveListSearch(ridersSearchSchema, DEFAULT_RIDERS_SEARCH_PARAMS, url.searchParams),
    }
  }

  if (path === "/rider-locations") {
    return {
      to: "/rider-locations",
      search: resolveListSearch(
        riderLocationsSearchSchema,
        DEFAULT_RIDER_LOCATIONS_SEARCH_PARAMS,
        url.searchParams,
      ),
    }
  }

  if (path === "/pickups") {
    return {
      to: "/pickups",
      search: resolveListSearch(
        pickupsSearchSchema,
        DEFAULT_PICKUPS_SEARCH_PARAMS,
        url.searchParams,
      ),
    }
  }

  if (path === "/delivery-proofs") {
    return {
      to: "/delivery-proofs",
      search: resolveListSearch(
        deliveryProofsSearchSchema,
        DEFAULT_DELIVERY_PROOFS_SEARCH_PARAMS,
        url.searchParams,
      ),
    }
  }

  if (path === "/deliveries") {
    return {
      to: "/deliveries",
      search: resolveListSearch(
        deliveriesSearchSchema,
        DEFAULT_DELIVERIES_SEARCH_PARAMS,
        url.searchParams,
      ),
    }
  }

  if (path === "/transfers") {
    return {
      to: "/transfers",
      search: resolveListSearch(
        transfersSearchSchema,
        DEFAULT_TRANSFERS_SEARCH_PARAMS,
        url.searchParams,
      ),
    }
  }

  return { to: "/" }
}

/** The list URL is the only place a hand-edited query string can arrive from. */
function resolveParcelSearch(params: URLSearchParams) {
  const parsed = parcelsSearchSchema.safeParse({
    page: params.get("page") ?? undefined,
    limit: params.get("limit") ?? undefined,
    sortBy: params.get("sortBy") ?? undefined,
    sort: params.get("sort") ?? undefined,
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
    paymentType: params.get("paymentType") ?? undefined,
    hubId: params.get("hubId") ?? undefined,
  })

  if (!parsed.success) return DEFAULT_PARCELS_SEARCH
  return parsed.data
}

/**
 * Shared resolver for the list screens that keep their state in the URL.
 *
 * The schemas `.catch` every field, so a hand-edited or stale link degrades to
 * that screen's defaults rather than being rejected outright.
 */
function resolveListSearch<T extends z.ZodType>(
  schema: T,
  fallback: z.infer<T>,
  params: URLSearchParams,
): z.infer<T> {
  const parsed = schema.safeParse(Object.fromEntries(params))
  return parsed.success ? parsed.data : fallback
}
