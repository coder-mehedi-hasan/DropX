import * as LabelPrimitive from "@radix-ui/react-label"
import type * as React from "react"

import { cn } from "../../lib/cn"

/**
 * Label.
 *
 * Radix rather than a bare `<label>`: it blocks the double-click-to-select-text
 * and double-click-to-focus-the-control behaviour that makes form panels in the
 * console feel janky.
 */
export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}
