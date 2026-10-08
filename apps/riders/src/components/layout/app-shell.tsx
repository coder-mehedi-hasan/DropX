import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"
import { Avatar, AvatarFallback, DropXMark, buttonVariants, cn } from "@dropx/ui"

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
    <div className="rider-app-shell bg-background text-foreground mx-auto flex min-h-dvh w-full max-w-lg flex-col overflow-x-hidden sm:my-4 sm:min-h-[calc(100dvh-2rem)] sm:rounded-[1.75rem]">
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
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/82 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3.5 backdrop-blur-xl sm:rounded-t-[1.75rem]">
      {back ? (
        <Link
          to="/jobs"
          aria-label="Back to jobs"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "tap-target -ml-1 size-11 rounded-xl",
          )}
        >
          <ChevronLeft className="size-6" />
        </Link>
      ) : (
        <DropXMark className="size-10 rounded-xl shadow-sm" />
      )}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg leading-tight font-extrabold tracking-[-0.025em]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{subtitle}</p>
        ) : null}
      </div>

      {actions?.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled || action.busy}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "tap-target bg-card max-w-[10rem] rounded-xl px-3 shadow-xs",
          )}
        >
          {action.icon}
          <span className="truncate">{action.label}</span>
        </button>
      ))}

      {rider ? (
        <Avatar className="size-10 rounded-xl">
          <AvatarFallback className="bg-foreground text-background rounded-xl text-sm font-bold">
            {initials(rider.name)}
          </AvatarFallback>
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
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/82 sticky bottom-[4.5rem] z-20 border-t px-4 py-3 backdrop-blur-xl">
      {children}
    </div>
  )
}
