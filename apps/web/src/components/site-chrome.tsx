import { DropXLogo } from "@dropx/ui"
import Link from "next/link"
import type * as React from "react"

import { HeaderActions } from "@/components/header-actions"

const NAV = [
  { href: "/track", label: "Track" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/become-a-rider", label: "Become a rider" },
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
    <header className="bg-background/80 sticky top-0 z-40 w-full border-b backdrop-blur-xl">
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

        <HeaderActions />
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="bg-card border-t">
      <div className="max-w-page mx-auto grid w-full gap-8 px-4 py-12 text-sm sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <DropXLogo size="sm" className="text-foreground" />
          <p className="text-muted-foreground max-w-xs">
            Parcel delivery and logistics, hub to hub to doorstep.
          </p>
        </div>
        <FooterColumn
          title="Customers"
          links={[
            { href: "/track", label: "Track a parcel" },
            { href: "/login", label: "Sign in" },
            { href: "/#pricing", label: "Pricing" },
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            { href: "/become-a-rider", label: "Become a rider" },
            { href: "/brand-guidelines", label: "Brand guidelines" },
          ]}
        />
      </div>
      <div className="border-t">
        <p className="text-muted-foreground max-w-page mx-auto w-full px-4 py-5 text-xs">
          © {new Date().getFullYear()} DropX Technologies
        </p>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: readonly { href: string; label: string }[]
}) {
  return (
    <nav aria-label={title} className="grid content-start gap-3">
      <p className="text-xs font-semibold tracking-wide uppercase">{title}</p>
      <ul className="grid gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
