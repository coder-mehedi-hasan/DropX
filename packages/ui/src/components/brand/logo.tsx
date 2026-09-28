import type * as React from "react"

import { cn } from "../../lib/cn"

/**
 * The DropX mark and wordmark.
 *
 * Inlined from the approved production geometry in `apps/web/public/brand/`
 * (`dropx-mark.svg`, `dropx-wordmark-light.svg`) so admin and riders — which do
 * not ship the full brand asset tree — cannot drift from the matrix. This is the
 * approved horizontal wordmark lockup rendered as one component, not a new
 * combination of mark + wordmark invented in app code.
 *
 * The wordmark text inherits `currentColor` so one component serves the light
 * customer canvas and the Obsidian operations surfaces. Print/vendor handoff
 * still uses the outlined SVG assets.
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
 * Approved horizontal wordmark for headers and navigation.
 *
 * Matches `dropx-wordmark-light.svg`: mark + Drop + Volt X. The trailing X uses
 * `text-primary` (fill) because it is large display type on the lockup.
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
 * Stacked sign-in lockup with the "Smart logistics" descriptor.
 *
 * Only for centred hero space where the descriptor stays legible — matching the
 * brand book rule that the descriptor is optional and dropped elsewhere.
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
