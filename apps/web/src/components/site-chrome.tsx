import { Button, DropXLogo, Separator } from "@dropx/ui"
import Link from "next/link"
import type * as React from "react"

const NAV = [
  { href: "/track", label: "Track" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
] as const

/**
 * Marketing chrome.
 *
 * Light-first by brand rule: the customer portal keeps `#F7F8FA` as its canvas
 * and reserves Volt Orange for the one primary action per region. The logo is the
 * shared `DropXLogo` rather than an inline `<img>`, so the lockup cannot drift
 * from the mark the admin and rider apps show.
 */
export function SiteHeader() {
  return (
    <header className="bg-background/90 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="max-w-page mx-auto flex h-16 w-full items-center gap-6 px-4">
        <Link href="/" className="text-foreground hover:text-foreground shrink-0">
          <DropXLogo size="md" />
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <Button asChild>
            <Link href="/login">Book a parcel</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="bg-card border-t">
      <div className="text-muted-foreground max-w-page mx-auto flex w-full flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2">
          <DropXLogo size="sm" className="text-foreground" />
          <p>Parcel delivery and logistics, hub to hub to doorstep.</p>
        </div>
        <p className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/track" className="hover:text-foreground">
            Track a parcel
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
          <Link href="/brand-guidelines" className="hover:text-foreground">
            Brand guidelines
          </Link>
        </p>
      </div>
    </footer>
  )
}
