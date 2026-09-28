import type * as React from "react"

import { cn } from "../../lib/cn"

/**
 * Textarea.
 *
 * Shares the Input's border/focus tokens because the two sit side by side in
 * DropX's support-ticket and address-note forms and any visual difference reads
 * as a rendering bug.
 */
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  )
}
