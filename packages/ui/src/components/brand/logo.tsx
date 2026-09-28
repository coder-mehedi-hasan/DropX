import type * as React from "react"

import { cn } from "../../lib/cn"

/**
 * The DropX mark and wordmark.
 *
 * Inlined rather than loaded from `apps/web/public/brand/*.svg` because three
 * apps share one lockup and two of them have no static-asset directory at all —
 * an `<img>` would mean copying the same SVG into three public folders and
 * letting them drift. These paths are the production geometry from
 * `dropx-mark.svg` and `dropx-favicon.svg`; treat those files as the source of
 * truth and change both together.
 *
 * The wordmark is drawn as text rather than outlined paths so it inherits the
 * app's Inter stack and `currentColor`, which is what lets one component serve
 * the light surfaces of the customer portal and the Obsidian surfaces of the
 * operations tools. The brand book only requires outlining for print and vendor
 * handoff, not for screen.
 */

const MARK_VIEWBOX = "0 0 128 128"

/**
 * The mark alone: an orange rounded square carrying a white D and a forward
 * arrow. Sized by the caller, so pass a `size-*` class.
 */
export function DropXMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      className={cn("size-8 shrink-0", className)}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect width="128" height="128" rx="32" fill="#FF5500" />
      <path
        fill="#fff"
        d="M31 30h28c20 0 34 13 34 34s-14 34-34 34H31V30Zm24 49c10 0 16-5 16-15s-6-15-16-15h-5v30h5Z"
      />
      <path fill="#FF5500" d="M77 56h18v8H77z" />
      <path fill="#FF5500" d="m89 49 15 11-15 11v-8H77v-6h12v-8Z" />
    </svg>
  )
}

const WORDMARK_SIZES = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
} as const

/**
 * Mark plus wordmark — the default lockup for a header.
 *
 * The trailing `X` is Volt Orange, matching the shipped wordmark SVGs, and the
 * rest of the wordmark is `currentColor` so it reads as ink on a light canvas
 * and as white on Obsidian without a second component.
 */
export function DropXLogo({
  className,
  size = "md",
  showMark = true,
  ...props
}: React.ComponentProps<"span"> & {
  size?: keyof typeof WORDMARK_SIZES
  showMark?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-extrabold tracking-tight",
        WORDMARK_SIZES[size],
        className,
      )}
      {...props}
    >
      {showMark ? <DropXMark className="size-[1.35em] rounded-[0.3em]" /> : null}
      <span>
        Drop
        <span className="text-primary">X</span>
      </span>
    </span>
  )
}

/**
 * The stacked mark with the "Smart logistics" descriptor.
 *
 * Only for a sign-in screen or another centred hero where there is room for the
 * descriptor to stay legible — the brand book keeps the descriptor optional and
 * drops it everywhere else.
 */
export function DropXLockup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("inline-flex flex-col items-center gap-3", className)} {...props}>
      <DropXMark className="size-14 rounded-[0.35em]" />
      <div className="grid gap-1 text-center">
        <DropXLogo size="lg" showMark={false} />
        <p className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.28em] uppercase">
          Smart logistics
        </p>
      </div>
    </div>
  )
}
