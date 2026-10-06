import { Link, useRouterState } from "@tanstack/react-router"
import {
  Bike,
  Building2,
  Car,
  Globe,
  Handshake,
  FileCheck,
  LayoutDashboard,
  MapPin,
  Package,
  PackageCheck,
  PackageSearch,
  Route,
  Truck,
  Users,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { DropXLogo, cn } from "@dropx/ui"

import { useAuth } from "@/lib/auth"
import { DEFAULT_BRANCHES_SEARCH, DEFAULT_HUBS_SEARCH, DEFAULT_PARCELS_SEARCH } from "@/lib/parcels"
import { DEFAULT_VEHICLES_SEARCH_PARAMS } from "@/routes/vehicles-search-params"
import { DEFAULT_ZONES_SEARCH_PARAMS } from "@/routes/zones-search-params"
import { DEFAULT_PRICING_RULES_SEARCH_PARAMS } from "@/routes/pricing-rules-search-params"
import type { BranchesSearch, HubsSearch, ParcelListSearch } from "@/lib/parcels"
import type { VehiclesSearch } from "@/routes/vehicles-search-params"
import type { ZonesSearch } from "@/routes/zones-search-params"
import type { PricingRulesSearch } from "@/routes/pricing-rules-search-params"
import { DEFAULT_ROUTES_SEARCH_PARAMS } from "@/routes/routes-search-params"
import type { RoutesSearch } from "@/routes/routes-search-params"
import { DEFAULT_RIDERS_SEARCH_PARAMS } from "@/routes/riders-search-params"
import type { RidersSearch } from "@/routes/riders-search-params"
import { DEFAULT_USERS_SEARCH_PARAMS } from "@/routes/users-search-params"
import type { UsersSearch } from "@/routes/users-search-params"
import { DEFAULT_RIDER_LOCATIONS_SEARCH_PARAMS } from "@/routes/rider-locations-search-params"
import type { RiderLocationsSearch } from "@/routes/rider-locations-search-params"
import { DEFAULT_RIDER_APPLICATIONS_SEARCH } from "@/routes/rider-applications-search-params"
import type { RiderApplicationsSearch } from "@/routes/rider-applications-search-params"
import { DEFAULT_PICKUPS_SEARCH_PARAMS } from "@/routes/pickups-search-params"
import type { PickupsSearch } from "@/routes/pickups-search-params"
import { DEFAULT_TRANSFERS_SEARCH_PARAMS } from "@/routes/transfers-search-params"
import type { TransfersSearch } from "@/routes/transfers-search-params"
import { DEFAULT_DELIVERIES_SEARCH_PARAMS } from "@/routes/deliveries-search-params"
import type { DeliveriesSearch } from "@/routes/deliveries-search-params"
import { DEFAULT_DELIVERY_PROOFS_SEARCH_PARAMS } from "@/routes/delivery-proofs-search-params"
import type { DeliveryProofsSearch } from "@/routes/delivery-proofs-search-params"
import type { PermissionKey } from "@/lib/permissions"
export type NavItem = {
  label: string
  to:
    | "/"
    | "/parcels"
    | "/tracking"
    | "/branches"
    | "/hubs"
    | "/users"
    | "/zones"
    | "/vehicles"
    | "/pricing-rules"
    | "/routes"
    | "/riders"
    | "/rider-locations"
    | "/rider-applications"
    | "/pickups"
    | "/transfers"
    | "/deliveries"
    | "/delivery-proofs"
  search?:
    | ParcelListSearch
    | BranchesSearch
    | HubsSearch
    | UsersSearch
    | ZonesSearch
    | VehiclesSearch
    | PricingRulesSearch
    | RoutesSearch
    | RidersSearch
    | RiderLocationsSearch
    | RiderApplicationsSearch
    | PickupsSearch
    | TransfersSearch
    | DeliveriesSearch
    | DeliveryProofsSearch
    | undefined
  icon: LucideIcon
  permission: PermissionKey | null
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, permission: null },
  {
    label: "Parcels",
    to: "/parcels",
    search: DEFAULT_PARCELS_SEARCH,
    icon: PackageSearch,
    permission: "parcels.view",
  },
  { label: "Tracking", to: "/tracking", icon: Truck, permission: "parcels.view" },
  {
    label: "Branches",
    to: "/branches",
    search: DEFAULT_BRANCHES_SEARCH,
    icon: Building2,
    permission: "branches.view",
  },
  {
    label: "Hubs",
    to: "/hubs",
    search: DEFAULT_HUBS_SEARCH,
    icon: Warehouse,
    permission: "hubs.view",
  },
  // After Hubs: the people who sign into them. Accounts sit with the
  // organization screens because a staff row is branch-and-hub scoped the same
  // way a hub is branch scoped.
  {
    label: "Users",
    to: "/users",
    search: DEFAULT_USERS_SEARCH_PARAMS,
    icon: Users,
    permission: "users.view",
  },
  {
    label: "Zones",
    to: "/zones",
    search: DEFAULT_ZONES_SEARCH_PARAMS,
    icon: Globe,
    permission: "zones.view",
  },
  {
    label: "Vehicles",
    to: "/vehicles",
    search: DEFAULT_VEHICLES_SEARCH_PARAMS,
    icon: Car,
    permission: "vehicles.view",
  },
  {
    label: "Pricing Rules",
    to: "/pricing-rules",
    search: DEFAULT_PRICING_RULES_SEARCH_PARAMS,
    icon: Package,
    permission: "pricing.view",
  },
  {
    label: "Routes",
    to: "/routes",
    search: DEFAULT_ROUTES_SEARCH_PARAMS,
    icon: Route,
    permission: "routes.view",
  },
  {
    label: "Riders",
    to: "/riders",
    search: DEFAULT_RIDERS_SEARCH_PARAMS,
    icon: Bike,
    permission: "riders.view",
  },
  {
    label: "Rider Locations",
    to: "/rider-locations",
    search: DEFAULT_RIDER_LOCATIONS_SEARCH_PARAMS,
    icon: MapPin,
    permission: "riders.view",
  },
  {
    label: "Rider Applications",
    to: "/rider-applications",
    search: DEFAULT_RIDER_APPLICATIONS_SEARCH,
    icon: FileCheck,
    permission: "riders.view",
  },
  // After Parcels and before the fleet screens: a pickup is a parcel-side action,
  // and the fleet is who performs it.
  {
    label: "Pickups",
    to: "/pickups",
    search: DEFAULT_PICKUPS_SEARCH_PARAMS,
    icon: PackageCheck,
    permission: "pickups.view",
  },
  // After Pickups: a transfer is the same work at a longer distance, and the two
  // screens read alike.
  {
    label: "Transfers",
    to: "/transfers",
    search: DEFAULT_TRANSFERS_SEARCH_PARAMS,
    icon: Truck,
    permission: "transfers.view",
  },
  // After Transfers: the attempt the transfer fed, in the last mile.
  {
    label: "Deliveries",
    to: "/deliveries",
    search: DEFAULT_DELIVERIES_SEARCH_PARAMS,
    icon: Handshake,
    permission: "deliveries.view",
  },
  // After Deliveries: what was recorded at the door.
  {
    label: "Delivery proofs",
    to: "/delivery-proofs",
    search: DEFAULT_DELIVERY_PROOFS_SEARCH_PARAMS,
    icon: FileCheck,
    permission: "deliveries.view",
  },
]

export function Sidebar() {
  const { hasPermission } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const visible = NAV_ITEMS.filter(
    (item) => item.permission === null || hasPermission(item.permission),
  )

  return (
    <aside className="bg-card hidden w-64 shrink-0 flex-col gap-1 border-r px-3 py-4 md:flex">
      <div className="px-2 pb-5">
        <DropXLogo size="sm" />
        <p className="text-muted-foreground mt-1 pl-9 text-xs">Operations portal</p>
      </div>

      <p className="text-muted-foreground px-2 pb-1 text-xs font-semibold tracking-[0.16em] uppercase">
        Workspace
      </p>

      <nav className="flex flex-col gap-1" aria-label="Main">
        {visible.map((item) => {
          const active =
            item.to === "/"
              ? pathname === "/"
              : pathname === item.to || pathname.startsWith(`${item.to}/`)
          return (
            <Link
              key={item.to}
              to={item.to}
              search={item.search}
              /*
               * The active destination is marked three ways, not one: a Volt
               * rail, a Volt-tinted ground, and bold ink. The brand requires a
               * status colour never to be the only signal, and a sidebar item is
               * a status a dispatcher reads at a glance.
               */
              className={cn(
                "ease-brand relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-primary/12 text-foreground before:bg-primary font-semibold before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <p className="text-muted-foreground mt-auto px-2 text-xs leading-relaxed">
        Staff only. Actions are audited against your account.
      </p>
    </aside>
  )
}
