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
 *
 * The success and danger variants are declared here rather than left to sonner's
 * `richColors`, which ships its own red and green and would put a fourth palette
 * on screen. These use the same `--success` / `--destructive` tokens as every
 * other status surface, and each toast keeps its own text label — the brand
 * requires status colour never to be the only signal.
 */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:border-success/30 group-[.toaster]:bg-success/10 group-[.toaster]:text-foreground",
          error:
            "group-[.toaster]:border-destructive/30 group-[.toaster]:bg-destructive/10 group-[.toaster]:text-foreground",
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
