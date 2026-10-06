import { createRoute, lazyRouteComponent } from "@tanstack/react-router"

import { AppShell } from "@/components/layout/app-shell"
import { RequirePermission } from "@/lib/auth"

import { rootRoute } from "./root"
import { branchesSearchSchema, hubsSearchSchema } from "./org-search-params"
import { loginSearchSchema, parcelsSearchSchema, trackingSearchSchema } from "./search-params"
import { vehiclesSearchSchema } from "./vehicles-search-params"
import { zonesSearchSchema } from "./zones-search-params"
import { pricingRulesSearchSchema } from "./pricing-rules-search-params"
import { routesSearchSchema } from "./routes-search-params"
import { ridersSearchSchema } from "./riders-search-params"
import { usersSearchSchema } from "./users-search-params"
import { rolesSearchSchema } from "./roles-search-params"
import { riderLocationsSearchSchema } from "./rider-locations-search-params"
import { riderApplicationsSearchSchema } from "./rider-applications-search-params"
import { pickupsSearchSchema } from "./pickups-search-params"
import { transfersSearchSchema } from "./transfers-search-params"
import { deliveriesSearchSchema } from "./deliveries-search-params"
import { deliveryProofsSearchSchema } from "./delivery-proofs-search-params"

/**
 * Feature screens are split out of the entry chunk on purpose: signing in should
 * not cost the login page the parcel booking dialog and its field array, and the
 * parcel list should not cost the dashboard the tracking timeline.
 */
const LoginPage = lazyRouteComponent(() => import("@/features/auth/login-page"), "LoginPage")
const DashboardPage = lazyRouteComponent(
  () => import("@/features/dashboard/dashboard-page"),
  "DashboardPage",
)
const ParcelsListPage = lazyRouteComponent(
  () => import("@/features/parcels/parcels-list-page"),
  "ParcelsListPage",
)
const ParcelDetailPage = lazyRouteComponent(
  () => import("@/features/parcels/parcel-detail-page"),
  "ParcelDetailPage",
)
const TrackingPage = lazyRouteComponent(
  () => import("@/features/tracking/tracking-page"),
  "TrackingPage",
)
const BranchesListPage = lazyRouteComponent(
  () => import("@/features/org/branches-list-page"),
  "BranchesListPage",
)
const HubsListPage = lazyRouteComponent(
  () => import("@/features/org/hubs-list-page"),
  "HubsListPage",
)
const ZonesListPage = lazyRouteComponent(
  () => import("@/features/zones/zones-list-page"),
  "ZonesListPage",
)
const VehiclesListPage = lazyRouteComponent(
  () => import("@/features/vehicles/vehicles-list-page"),
  "VehiclesListPage",
)
const PricingRulesListPage = lazyRouteComponent(
  () => import("@/features/pricing/pricing-rules-list-page"),
  "PricingRulesListPage",
)
const RoutesListPage = lazyRouteComponent(
  () => import("@/features/routes/routes-list-page"),
  "RoutesListPage",
)
const RidersListPage = lazyRouteComponent(
  () => import("@/features/riders/riders-list-page"),
  "RidersListPage",
)
const UsersListPage = lazyRouteComponent(
  () => import("@/features/users/users-list-page"),
  "UsersListPage",
)
const RolesListPage = lazyRouteComponent(
  () => import("@/features/roles/roles-list-page"),
  "RolesListPage",
)
const RiderLocationsListPage = lazyRouteComponent(
  () => import("@/features/riders/rider-locations-list-page"),
  "RiderLocationsListPage",
)
const RiderApplicationsListPage = lazyRouteComponent(
  () => import("@/features/riders/rider-applications-list-page"),
  "RiderApplicationsListPage",
)
const PickupsListPage = lazyRouteComponent(
  () => import("@/features/pickups/pickups-list-page"),
  "PickupsListPage",
)
const TransfersListPage = lazyRouteComponent(
  () => import("@/features/transfers/transfers-list-page"),
  "TransfersListPage",
)
const DeliveriesListPage = lazyRouteComponent(
  () => import("@/features/deliveries/deliveries-list-page"),
  "DeliveriesListPage",
)
const DeliveryProofsListPage = lazyRouteComponent(
  () => import("@/features/deliveries/delivery-proofs-list-page"),
  "DeliveryProofsListPage",
)

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: loginSearchSchema,
  component: LoginPage,
})

/**
 * Pathless layout for every signed-in screen. `RequireAuth` lives inside
 * `AppShell`, so a route added here is authenticated by construction.
 */
export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppShell,
})

export const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: DashboardPage,
})

export const parcelsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/parcels",
  validateSearch: parcelsSearchSchema,
  component: ParcelsListPageRoute,
})

export const parcelDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/parcels/$parcelId",
  component: ParcelDetailRoute,
})

export const trackingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/tracking",
  validateSearch: trackingSearchSchema,
  component: TrackingRoute,
})

export const branchesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/branches",
  validateSearch: branchesSearchSchema,
  component: BranchesListPageRoute,
})

export const hubsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/hubs",
  validateSearch: hubsSearchSchema,
  component: HubsListPageRoute,
})

export const usersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/users",
  validateSearch: usersSearchSchema,
  component: UsersListPageRoute,
})

export const rolesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/roles",
  validateSearch: rolesSearchSchema,
  component: RolesListPageRoute,
})

export const zonesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/zones",
  validateSearch: zonesSearchSchema,
  component: ZonesListPageRoute,
})

export const vehiclesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/vehicles",
  validateSearch: vehiclesSearchSchema,
  component: VehiclesListPageRoute,
})

export const pricingRulesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/pricing-rules",
  validateSearch: pricingRulesSearchSchema,
  component: PricingRulesListPageRoute,
})

export const routesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/routes",
  validateSearch: routesSearchSchema,
  component: RoutesListPageRoute,
})

export const ridersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/riders",
  validateSearch: ridersSearchSchema,
  component: RidersListPageRoute,
})

export const riderLocationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/rider-locations",
  validateSearch: riderLocationsSearchSchema,
  component: RiderLocationsListPageRoute,
})

export const riderApplicationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/rider-applications",
  validateSearch: riderApplicationsSearchSchema,
  component: RiderApplicationsListPageRoute,
})

export const pickupsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/pickups",
  validateSearch: pickupsSearchSchema,
  component: PickupsListPageRoute,
})

export const transfersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/transfers",
  validateSearch: transfersSearchSchema,
  component: TransfersListPageRoute,
})

export const deliveriesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/deliveries",
  validateSearch: deliveriesSearchSchema,
  component: DeliveriesListPageRoute,
})

export const deliveryProofsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/delivery-proofs",
  validateSearch: deliveryProofsSearchSchema,
  component: DeliveryProofsListPageRoute,
})

/**
 * These wrappers exist so the permission key that guards a screen sits directly
 * above that screen's route, instead of being buried inside a page component
 * that some future route could reach another way.
 */
function ParcelsListPageRoute() {
  const search = parcelsRoute.useSearch()
  return (
    <RequirePermission permission="parcels.view">
      <ParcelsListPage search={search} />
    </RequirePermission>
  )
}

function ParcelDetailRoute() {
  const { parcelId } = parcelDetailRoute.useParams()
  return (
    <RequirePermission permission="parcels.view">
      <ParcelDetailPage parcelId={parcelId} />
    </RequirePermission>
  )
}

function TrackingRoute() {
  const search = trackingRoute.useSearch()
  return (
    <RequirePermission permission="parcels.view">
      <TrackingPage tracking={search.tracking} />
    </RequirePermission>
  )
}

function BranchesListPageRoute() {
  const search = branchesRoute.useSearch()
  return (
    <RequirePermission permission="branches.view">
      <BranchesListPage search={search} />
    </RequirePermission>
  )
}

function HubsListPageRoute() {
  const search = hubsRoute.useSearch()
  return (
    <RequirePermission permission="hubs.view">
      <HubsListPage search={search} />
    </RequirePermission>
  )
}

function UsersListPageRoute() {
  const search = usersRoute.useSearch()
  return (
    <RequirePermission permission="users.view">
      <UsersListPage search={search} />
    </RequirePermission>
  )
}

function RolesListPageRoute() {
  const search = rolesRoute.useSearch()
  return (
    <RequirePermission permission="roles.view">
      <RolesListPage search={search} />
    </RequirePermission>
  )
}

function ZonesListPageRoute() {
  const search = zonesRoute.useSearch()
  return (
    <RequirePermission permission="zones.view">
      <ZonesListPage search={search} />
    </RequirePermission>
  )
}

function VehiclesListPageRoute() {
  const search = vehiclesRoute.useSearch()
  return (
    <RequirePermission permission="vehicles.view">
      <VehiclesListPage search={search} />
    </RequirePermission>
  )
}

function PricingRulesListPageRoute() {
  const search = pricingRulesRoute.useSearch()
  return (
    <RequirePermission permission="pricing.view">
      <PricingRulesListPage search={search} />
    </RequirePermission>
  )
}

function RoutesListPageRoute() {
  const search = routesRoute.useSearch()
  return (
    <RequirePermission permission="routes.view">
      <RoutesListPage search={search} />
    </RequirePermission>
  )
}

function RidersListPageRoute() {
  const search = ridersRoute.useSearch()
  return (
    <RequirePermission permission="riders.view">
      <RidersListPage search={search} />
    </RequirePermission>
  )
}

/**
 * `riders.view`, not a new key: reading where a rider is is reading a rider, and
 * a separate permission would only create a state where someone can see the
 * roster but not the fleet's positions.
 */
function RiderLocationsListPageRoute() {
  const search = riderLocationsRoute.useSearch()
  return (
    <RequirePermission permission="riders.view">
      <RiderLocationsListPage search={search} />
    </RequirePermission>
  )
}

function RiderApplicationsListPageRoute() {
  const search = riderApplicationsRoute.useSearch()
  return (
    <RequirePermission permission="riders.view">
      <RiderApplicationsListPage search={search} />
    </RequirePermission>
  )
}

function PickupsListPageRoute() {
  const search = pickupsRoute.useSearch()
  return (
    <RequirePermission permission="pickups.view">
      <PickupsListPage search={search} />
    </RequirePermission>
  )
}

function DeliveryProofsListPageRoute() {
  const search = deliveryProofsRoute.useSearch()
  return (
    <RequirePermission permission="deliveries.view">
      <DeliveryProofsListPage search={search} />
    </RequirePermission>
  )
}

function DeliveriesListPageRoute() {
  const search = deliveriesRoute.useSearch()
  return (
    <RequirePermission permission="deliveries.view">
      <DeliveriesListPage search={search} />
    </RequirePermission>
  )
}

function TransfersListPageRoute() {
  const search = transfersRoute.useSearch()
  return (
    <RequirePermission permission="transfers.view">
      <TransfersListPage search={search} />
    </RequirePermission>
  )
}
