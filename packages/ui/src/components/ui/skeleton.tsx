import type * as React from "react"

import { cn } from "../../lib/cn"

/**
 * Skeleton.
 *
 * A pulsing placeholder rather than a spinner: parcel and settlement lists keep
 * their final row count during load, so the layout doesn't jump when data lands.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-lg", className)}
      {...props}
    />
  )
}
