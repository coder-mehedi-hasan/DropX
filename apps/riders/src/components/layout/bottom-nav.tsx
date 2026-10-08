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
      className="bg-background/95 supports-[backdrop-filter]:bg-background/82 sticky bottom-0 z-30 border-t px-3 pt-1 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:rounded-b-[1.75rem]"
    >
      <ul className="mx-auto flex max-w-sm gap-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.to)
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                /*
                 * The active tab is marked three ways: a Volt rail, a Volt icon
                 * and bold ink. A rider glances at this bar dozens of times a
                 * shift in sunlight, so the destination never depends on
                 * spotting a colour alone.
                 */
                className={cn(
                  "ease-brand relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs transition-all duration-150 active:scale-[0.98]",
                  active
                    ? "bg-primary/10 text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground font-medium",
                )}
              >
                <item.icon className={cn("size-5", active && "text-primary")} aria-hidden />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
