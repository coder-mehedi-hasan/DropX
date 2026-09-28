import { Link, useRouterState } from "@tanstack/react-router"
import { LayoutDashboard, PackageSearch, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@dropx/ui"

import { useAuth } from "@/lib/auth"
import { DEFAULT_PARCELS_SEARCH } from "@/lib/parcels"
import type { ParcelListSearch } from "@/lib/parcels"
import type { PermissionKey } from "@/lib/permissions"

/**
 * `validateSearch` on `/parcels` makes its search object required, so that nav
 * entry carries one while the untyped paths must not.
 *
 * `permission: null` means the screen is open to any signed-in staff member; a
 * key hides the item outright so the sidebar never advertises a screen that
 * would immediately render a refusal.
 */
export type NavItem =
  | {
      label: string
      to: "/parcels"
      search: ParcelListSearch
      icon: LucideIcon
      permission: PermissionKey | null
    }
  | {
      label: string
      to: "/" | "/tracking"
      search?: undefined
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
]

export function Sidebar() {
  const { hasPermission } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const visible = NAV_ITEMS.filter(
    (item) => item.permission === null || hasPermission(item.permission),
  )

  return (
    <aside className="bg-card hidden w-60 shrink-0 flex-col gap-1 border-r px-3 py-4 md:flex">
      <div className="flex items-center gap-2 px-2 pb-4">
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold">
          DX
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">DropX</p>
          <p className="text-muted-foreground text-xs">Ops portal</p>
        </div>
      </div>

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
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <p className="text-muted-foreground mt-auto px-2 text-xs">
        Staff only. Actions are audited against your account.
      </p>
    </aside>
  )
}
