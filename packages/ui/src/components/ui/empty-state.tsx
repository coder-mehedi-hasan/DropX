import type * as React from "react"

import { cn } from "../../lib/cn"

/**
 * EmptyState.
 *
 * DropX screens are list-shaped, so "no data" is a first-class state rather than
 * an afterthought: without it, an empty parcel list looks like a failed load. The
 * action slot is optional because some empty states (a branch with no hubs yet)
 * have nothing useful to link to.
 */
export function EmptyState({
  className,
  icon: Icon,
  title,
  description,
  action,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ComponentType<React.ComponentProps<"svg">>
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <div
          data-slot="empty-state-icon"
          className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full [&_svg]:size-5"
        >
          <Icon />
        </div>
      ) : null}
      <div className="grid gap-1">
        <p data-slot="empty-state-title" className="text-sm font-medium">
          {title}
        </p>
        {description ? (
          <p
            data-slot="empty-state-description"
            className="text-muted-foreground max-w-prose text-sm"
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div data-slot="empty-state-action" className="mt-1">
          {action}
        </div>
      ) : null}
    </div>
  )
}
