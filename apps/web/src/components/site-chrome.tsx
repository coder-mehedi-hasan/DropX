import { Button, Separator } from "@dropx/ui"
import { Package } from "lucide-react"
import Link from "next/link"
import type * as React from "react"

const NAV = [
  { href: "/track", label: "Track" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
] as const

export function SiteHeader() {
  return (
    <header className="bg-background/95 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
            <Package className="size-4" aria-hidden />
          </span>
          DropX
        </Link>

        <nav className="hidden items-center gap-5 text-sm sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground"
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
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>DropX — parcel delivery and logistics.</p>
        <p className="flex items-center gap-4">
          <Link href="/track" className="hover:text-foreground">
            Track a parcel
          </Link>
          <Link href="/brand-guidelines" className="hover:text-foreground">
            Brand guidelines
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
        </p>
      </div>
    </footer>
  )
}
