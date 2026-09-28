import { Link, useRouterState } from "@tanstack/react-router"
import { ClipboardList, UserRound } from "lucide-react"
import { cn } from "@dropx/ui"

const NAV_ITEMS = [
  { to: "/jobs", label: "Jobs", icon: ClipboardList },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const

function isActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * Bottom navigation.
 *
 * Sits at the bottom of the shell because that is where a rider's thumb rests
 * while the phone is held one-handed, and every target is at least 44px tall
 * with a text label so the destination never depends on recognising an icon.
 */
export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <nav
      aria-label="Primary"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-30 border-t backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.to)
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "text-muted-foreground border-transparent",
                )}
              >
                <item.icon className="size-6" aria-hidden />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
