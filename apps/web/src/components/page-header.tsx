import { cn } from "@dropx/ui"
import type * as React from "react"

/**
 * The page title block every portal screen opens with: an accent eyebrow, one
 * h1, an optional supporting line and the page's actions. One component keeps
 * the heading scale (text-3xl bold) and the eyebrow treatment identical across
 * booking, parcels and tracking instead of each screen restating them.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="grid max-w-2xl gap-2">
        {eyebrow ? (
          <p className="text-accent-ink text-xs font-semibold tracking-[0.16em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-bold tracking-tight text-balance">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm leading-6 sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  )
}
