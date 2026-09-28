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
        "border-input bg-background placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex field-sizing-content min-h-20 w-full rounded-lg border px-3 py-2 text-base shadow-xs transition-[color,box-shadow,border-color] duration-150 ease-brand focus-visible:ring-[3px] focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  )
}
