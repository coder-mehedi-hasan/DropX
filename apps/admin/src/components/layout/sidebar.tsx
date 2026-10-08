import { Link, useRouterState } from "@tanstack/react-router"
import { useEffect, useSyncExternalStore } from "react"
import {
  Banknote,
  Bike,
  Boxes,
  Building2,
  Car,
  ChevronRight,
  FileCheck,
  Gauge,
  Handshake,
  Layers,
  LayoutDashboard,
  MapPin,
  Network,
  PackageCheck,
  PackageSearch,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropXLogo,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@dropx/ui"

import { useAuth } from "@/lib/auth"
import { DEFAULT_BRANCHES_SEARCH, DEFAULT_HUBS_SEARCH, DEFAULT_PARCELS_SEARCH } from "@/lib/parcels"
import { DEFAULT_VEHICLES_SEARCH_PARAMS } from "@/routes/vehicles-search-params"
import { DEFAULT_CITIES_SEARCH_PARAMS } from "@/routes/locations-search-params"
import type {
  ServiceCitiesSearch,
  ServiceAreasSearch,
  ServiceZonesSearch,
} from "@/routes/locations-search-params"
import { DEFAULT_PRICING_LANES_SEARCH_PARAMS } from "@/routes/pricing-lanes-search-params"
import type { PricingLanesSearch } from "@/routes/pricing-lanes-search-params"
import type { BranchesSearch, HubsSearch, ParcelListSearch } from "@/lib/parcels"
import type { VehiclesSearch } from "@/routes/vehicles-search-params"
import { DEFAULT_ROUTES_SEARCH_PARAMS } from "@/routes/routes-search-params"
import type { RoutesSearch } from "@/routes/routes-search-params"
import { DEFAULT_RIDERS_SEARCH_PARAMS } from "@/routes/riders-search-params"
import type { RidersSearch } from "@/routes/riders-search-params"
import { DEFAULT_USERS_SEARCH_PARAMS } from "@/routes/users-search-params"
import type { UsersSearch } from "@/routes/users-search-params"
import { DEFAULT_ROLES_SEARCH_PARAMS } from "@/routes/roles-search-params"
import type { RolesSearch } from "@/routes/roles-search-params"
import { DEFAULT_CUSTOMERS_SEARCH_PARAMS } from "@/routes/customers-search-params"
import type { CustomersSearch } from "@/routes/customers-search-params"
import { DEFAULT_PAYMENTS_SEARCH_PARAMS } from "@/routes/payments-search-params"
import type { PaymentsSearch } from "@/routes/payments-search-params"
import { DEFAULT_SETTLEMENTS_SEARCH_PARAMS } from "@/routes/settlements-search-params"
import type { SettlementsSearch } from "@/routes/settlements-search-params"
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
    | "/roles"
    | "/customers"
    | "/payments"
    | "/settlements"
    | "/locations/cities"
    | "/locations/zones"
    | "/locations/areas"
    | "/vehicles"
    | "/pricing/matrix"
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
    | RolesSearch
    | CustomersSearch
    | PaymentsSearch
    | SettlementsSearch
    | ServiceCitiesSearch
    | ServiceZonesSearch
    | ServiceAreasSearch
    | VehiclesSearch
    | PricingLanesSearch
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

export type NavGroup = {
  id: string
  icon?: LucideIcon
  label: string | null
  items: readonly NavItem[]
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "home",
    label: null,
    items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard, permission: null }],
  },
  {
    id: "operations",
    icon: Boxes,
    label: "Operations",
    items: [
      {
        label: "Parcels",
        to: "/parcels",
        search: DEFAULT_PARCELS_SEARCH,
        icon: PackageSearch,
        permission: "parcels.view",
      },
      { label: "Tracking", to: "/tracking", icon: Truck, permission: "parcels.view" },
      {
        label: "Pickups",
        to: "/pickups",
        search: DEFAULT_PICKUPS_SEARCH_PARAMS,
        icon: PackageCheck,
        permission: "pickups.view",
      },
      {
        label: "Transfers",
        to: "/transfers",
        search: DEFAULT_TRANSFERS_SEARCH_PARAMS,
        icon: Truck,
        permission: "transfers.view",
      },
      {
        label: "Deliveries",
        to: "/deliveries",
        search: DEFAULT_DELIVERIES_SEARCH_PARAMS,
        icon: Handshake,
        permission: "deliveries.view",
      },
      {
        label: "Delivery proofs",
        to: "/delivery-proofs",
        search: DEFAULT_DELIVERY_PROOFS_SEARCH_PARAMS,
        icon: FileCheck,
        permission: "deliveries.view",
      },
    ],
  },
  {
    id: "network",
    icon: Network,
    label: "Network",
    items: [
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
      // Locations is the city → zone → area territory staff book parcels against.
      {
        label: "Locations",
        to: "/locations/cities",
        search: DEFAULT_CITIES_SEARCH_PARAMS,
        icon: Layers,
        permission: "locations.view",
      },
      {
        label: "Routes",
        to: "/routes",
        search: DEFAULT_ROUTES_SEARCH_PARAMS,
        icon: Route,
        permission: "routes.view",
      },
      {
        label: "Vehicles",
        to: "/vehicles",
        search: DEFAULT_VEHICLES_SEARCH_PARAMS,
        icon: Car,
        permission: "vehicles.view",
      },
      // The matrix is what quotes run on — one row per pickup-to-delivery lane with its bands.
      {
        label: "Pricing matrix",
        to: "/pricing/matrix",
        search: DEFAULT_PRICING_LANES_SEARCH_PARAMS,
        icon: Gauge,
        permission: "pricing.view",
      },
    ],
  },
  {
    id: "people",
    icon: UsersRound,
    label: "People",
    items: [
      // The nav item needs only customers.view; the activate override is gated
      // by customers.manage inside the screen.
      {
        label: "Customers",
        to: "/customers",
        search: DEFAULT_CUSTOMERS_SEARCH_PARAMS,
        icon: UserRound,
        permission: "customers.view",
      },
      {
        label: "Users",
        to: "/users",
        search: DEFAULT_USERS_SEARCH_PARAMS,
        icon: Users,
        permission: "users.view",
      },
      // The roles those users hold, and the permission grid that decides what
      // each role is for. Account and role are one screen pair in the RBAC doc.
      {
        label: "Roles",
        to: "/roles",
        search: DEFAULT_ROLES_SEARCH_PARAMS,
        icon: ShieldCheck,
        permission: "roles.view",
      },
    ],
  },
  {
    id: "riders",
    icon: Bike,
    label: "Riders",
    items: [
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
    ],
  },
  // Money closes the operation, so it sits last.
  {
    id: "money",
    icon: Banknote,
    label: "Money",
    items: [
      // The nav item needs only payments.view; the record/refund writes are
      // gated payments.manage inside the screen.
      {
        label: "Payments",
        to: "/payments",
        search: DEFAULT_PAYMENTS_SEARCH_PARAMS,
        icon: Wallet,
        permission: "payments.view",
      },
      // `create` needs settlements.manage (it writes the statement totals), so
      // the nav item only requires the read key and the screen gates the writes.
      {
        label: "Settlements",
        to: "/settlements",
        search: DEFAULT_SETTLEMENTS_SEARCH_PARAMS,
        icon: Handshake,
        permission: "settlements.view",
      },
    ],
  },
]

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

const COLLAPSED_STORAGE_KEY = "dropx.admin.nav.collapsed.v1"

function isItemActive(item: NavItem, pathname: string) {
  return item.to === "/"
    ? pathname === "/"
    : pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function readStoredCollapsed(): Set<string> | null {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"))
  } catch {
    return null
  }
}

let collapsedGroups: Set<string> =
  readStoredCollapsed() ??
  new Set(NAV_GROUPS.filter((group) => group.label !== null).map((group) => group.id))

const collapsedListeners = new Set<() => void>()

function writeCollapsed(next: Set<string>) {
  collapsedGroups = next
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]))
  } catch {
    // Storage can be unavailable (private mode); the in-memory state still holds.
  }
  collapsedListeners.forEach((listener) => listener())
}

function toggleGroup(id: string) {
  const next = new Set(collapsedGroups)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  writeCollapsed(next)
}

function openGroup(id: string) {
  if (!collapsedGroups.has(id)) return
  const next = new Set(collapsedGroups)
  next.delete(id)
  writeCollapsed(next)
}

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener)
  return () => {
    collapsedListeners.delete(listener)
  }
}

function useCollapsedGroups() {
  return useSyncExternalStore(subscribeCollapsed, () => collapsedGroups)
}

type NavLeafProps = {
  item: NavItem
  pathname: string
  onClick?: () => void
}

function NavLeaf({ item, pathname, onClick }: NavLeafProps) {
  const active = isItemActive(item, pathname)

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={active}>
        <Link
          to={item.to}
          search={item.search}
          onClick={onClick}
          aria-current={active ? "page" : undefined}
        >
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

export function AppSidebar() {
  const { hasPermission } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const collapsed = useCollapsedGroups()

  const closeOnNavigate = isMobile ? () => setOpenMobile(false) : undefined

  const activeGroupId = NAV_GROUPS.find(
    (group) => group.label !== null && group.items.some((item) => isItemActive(item, pathname)),
  )?.id

  // Navigating to a screen reveals the group that holds it, so the active page is
  // never hidden behind a collapsed section. Collapsing it again by hand sticks
  // until the next navigation.
  useEffect(() => {
    if (activeGroupId) openGroup(activeGroupId)
  }, [pathname, activeGroupId])

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 pt-1 pb-2">
          <DropXLogo size="sm" />
          <p className="text-muted-foreground mt-1 pl-9 text-xs">Operations portal</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.filter((group) => group.label === null).map((group) => {
          const items = group.items.filter(
            (item) => item.permission === null || hasPermission(item.permission),
          )
          if (items.length === 0) return null
          return (
            <SidebarGroup key={group.id}>
              <SidebarMenu>
                {items.map((item) => {
                  const active = isItemActive(item, pathname)
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link
                          to={item.to}
                          search={item.search}
                          onClick={closeOnNavigate}
                          aria-current={active ? "page" : undefined}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          )
        })}

        {NAV_GROUPS.filter((group) => group.label !== null).map((group) => {
          const items = group.items.filter(
            (item) => item.permission === null || hasPermission(item.permission),
          )
          if (items.length === 0) return null
          const groupActive = items.some((item) => isItemActive(item, pathname))
          const GroupIcon = group.icon

          return (
            <Collapsible
              key={group.id}
              open={!collapsed.has(group.id)}
              onOpenChange={() => toggleGroup(group.id)}
              className="group/collapsible"
            >
              <SidebarGroup>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={groupActive}>
                        {GroupIcon && <GroupIcon />}
                        <span>{group.label}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {items.map((item) => (
                          <NavLeaf
                            key={item.to}
                            item={item}
                            pathname={pathname}
                            onClick={closeOnNavigate}
                          />
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </Collapsible>
          )
        })}
      </SidebarContent>

      <SidebarFooter>
        <p className="text-muted-foreground px-2 pb-1 text-xs leading-relaxed">
          Staff only. Actions are audited against your account.
        </p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
