"use client"

import type * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Toaster.
 *
 * Re-exported so DropX apps never reach for `sonner` directly and end up with
 * two different toast styles. `theme` is passed straight through — DropX has no
 * `next-themes` provider, so the app that owns the dark-mode class owns the theme
 * value and hands it in here.
 */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
