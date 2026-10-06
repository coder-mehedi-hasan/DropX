import { Link } from "@tanstack/react-router"
import { cn } from "@dropx/ui"
import {
  DEFAULT_CITIES_SEARCH_PARAMS,
  DEFAULT_SERVICE_AREAS_SEARCH_PARAMS,
  DEFAULT_SERVICE_ZONES_SEARCH_PARAMS,
} from "@/routes/locations-search-params"

/**
 * City → Zone → Area switcher, shared by the three location screens.
 *
 * The hierarchy is one jurisdiction, so next/previous navigation between its
 * levels should be one click — and each tab carries the list back to its
 * defaults, because a City filter set on the Zones tab does not belong on the
 * Cities tab.
 */
const TABS = [
  { label: "Cities", to: "/locations/cities", search: DEFAULT_CITIES_SEARCH_PARAMS },
  { label: "Zones", to: "/locations/zones", search: DEFAULT_SERVICE_ZONES_SEARCH_PARAMS },
  { label: "Areas", to: "/locations/areas", search: DEFAULT_SERVICE_AREAS_SEARCH_PARAMS },
] as const

export function LocationTabs({ active }: { active: "cities" | "zones" | "areas" }) {
  return (
    <nav className="flex gap-1" aria-label="Locations">
      {TABS.map((tab) => {
        const isActive = tab.to === `/locations/${active}`
        return (
          <Link
            key={tab.to}
            to={tab.to}
            search={tab.search}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
