import { Link, useRouterState } from "@tanstack/react-router"
import { Building2, LayoutDashboard, PackageSearch, Truck, Warehouse } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { DropXLogo, cn } from "@dropx/ui"

import { useAuth } from "@/lib/auth"
import { DEFAULT_BRANCHES_SEARCH, DEFAULT_HUBS_SEARCH, DEFAULT_PARCELS_SEARCH } from "@/lib/parcels"
import type { BranchesSearch, HubsSearch, ParcelListSearch } from "@/lib/parcels"
import type { PermissionKey } from "@/lib/permissions"
export type NavItem = {
  label: string
  to: "/" | "/parcels" | "/tracking" | "/branches" | "/hubs"
  search?: ParcelListSearch | BranchesSearch | HubsSearch | undefined
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
                "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150 ease-brand",
                active
                  ? "bg-primary/12 text-foreground font-semibold before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon
                className={cn("size-4 shrink-0", active && "text-primary")}
                aria-hidden
              />
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
