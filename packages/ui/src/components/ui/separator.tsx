import * as SeparatorPrimitive from "@radix-ui/react-separator"
import type * as React from "react"

import { cn } from "../../lib/cn"

/**
 * Separator.
 *
 * Defaults to `decorative`: a `role="separator"` that screen readers announce
 * adds noise to the admin's panel lists, and DropX's separators are decorative
 * almost everywhere. Pass `decorative={false}` only when it actually divides
 * sections a screen-reader user needs to know about.
 */
export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  )
}
