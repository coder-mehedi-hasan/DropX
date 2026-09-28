import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"
import { Avatar, AvatarFallback, buttonVariants, cn } from "@dropx/ui"

import { useAuth } from "../../lib/auth"
import { initials } from "../../lib/format"
import { BottomNav } from "./bottom-nav"

export type ScreenHeaderAction = {
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  busy?: boolean
}

/**
 * Phone-sized app shell.
 *
 * Capped at `max-w-md` and centred so the layout is a phone layout on a laptop
 * and a full-bleed layout on a handset. Nothing is nested inside an inner
 * scroller: the document scrolls and the header, action bar and navigation stick
 * to the viewport, which is what keeps the thumb-reachable controls in place
 * without fighting the sheet and dialog scroll locks.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground mx-auto flex min-h-dvh w-full max-w-md flex-col border-x">
      {children}
      <BottomNav />
    </div>
  )
}

export function AppHeader({
  title,
  subtitle,
  back = false,
  actions,
}: {
  title: string
  subtitle?: string
  back?: boolean
  actions?: ScreenHeaderAction[]
}) {
  const { rider } = useAuth()

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex items-center gap-2 border-b px-3 py-3 backdrop-blur">
      {back ? (
        <Link
          to="/jobs"
          aria-label="Back to jobs"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "tap-target size-11")}
        >
          <ChevronLeft className="size-6" />
        </Link>
      ) : null}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg leading-tight font-semibold">{title}</h1>
        {subtitle ? <p className="text-muted-foreground truncate text-sm">{subtitle}</p> : null}
      </div>

      {actions?.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled || action.busy}
          className={cn(buttonVariants({ variant: "outline" }), "tap-target max-w-[10rem] px-3")}
        >
          {action.icon}
          <span className="truncate">{action.label}</span>
        </button>
      ))}

      {rider ? (
        <Avatar className="size-10">
          <AvatarFallback className="text-sm">{initials(rider.name)}</AvatarFallback>
        </Avatar>
      ) : null}
    </header>
  )
}

/**
 * Sticky action bar for the single primary action on a screen.
 *
 * Anchored to the bottom of the content column — above the navigation — so the
 * action is reachable with a thumb instead of scrolled to the top of a long
 * parcel.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-16 z-20 border-t px-3 py-3 backdrop-blur">
      {children}
    </div>
  )
}
