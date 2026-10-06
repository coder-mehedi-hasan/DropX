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
    <div className={cn("flex flex-wrap items-end justify-between gap-5", className)}>
      <div className="grid max-w-2xl gap-2.5">
        {eyebrow ? (
          <p className="text-accent-ink flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase">
            <span className="bg-primary h-px w-5" aria-hidden />
            <span>{eyebrow}</span>
          </p>
        ) : null}
        <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-[62ch] text-sm leading-6 sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  )
}
