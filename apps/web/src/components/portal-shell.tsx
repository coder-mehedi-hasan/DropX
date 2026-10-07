"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DropXLogo,
  LoadingButton,
  Skeleton,
  cn,
  useConfirmation,
} from "@dropx/ui"
import { LogOutIcon, MapPinIcon, PackageIcon, PlusIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

import { useAuth } from "@/lib/auth"

/**
 * The portal guard.
 *
 * `status === "unavailable"` is deliberately not a redirect: the API answering
 * with a 5xx says nothing about whether the customer is signed in, and bouncing
 * them to the OTP screen would look exactly like being logged out.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    if (status !== "anonymous") return
    router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [status, router, pathname])

  if (status === "authenticated") return <>{children}</>

  if (status === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-24">
        <Alert variant="destructive">
          <LogOutIcon aria-hidden />
          <AlertTitle>We could not reach DropX</AlertTitle>
          <AlertDescription>
            <p>Your session is intact, but the API did not answer.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => router.refresh()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <PortalSkeleton />
}

const NAV = [
  { href: "/dashboard", label: "My parcels", icon: PackageIcon },
  { href: "/book", label: "Book a parcel", icon: PlusIcon },
  { href: "/addresses", label: "Saved addresses", icon: MapPinIcon },
  { href: "/dashboard/track", label: "Track", icon: SearchIcon },
] as const

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { customer, signOut } = useAuth()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = React.useState(false)
  const { confirm, confirmationDialog } = useConfirmation()

  async function onSignOut() {
    const ok = await confirm({
      title: "Sign out of DropX?",
      description: "You will need a one-time code sent to your phone or email to sign back in.",
      confirmLabel: "Sign out",
    })
    if (!ok) return
    setSigningOut(true)
    await signOut()
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      {confirmationDialog}
      <a
        href="#portal-content"
        className="focus:bg-card focus:text-foreground fixed top-3 left-3 z-50 -translate-y-20 rounded-lg px-4 py-2 text-sm font-semibold shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen overflow-hidden bg-[#0D0F12] text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,rgba(255,85,0,.22),transparent_66%)]" />
        <div className="relative flex h-full flex-col px-4 py-6">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-2 text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#FF5500] focus-visible:outline-none"
          >
            <DropXLogo size="md" className="text-white" />
          </Link>

          <div className="mt-10 px-3">
            <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-white/45 uppercase">
              Customer workspace
            </p>
          </div>

          <nav className="mt-3 grid gap-1.5" aria-label="Customer portal">
            {NAV.map((item) => {
              const activeItem = NAV.map((n) => n.href)
                .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
                .sort((a, b) => b.length - a.length)[0]
              const active = activeItem === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-white text-[#0D0F12] shadow-[0_10px_30px_-16px_rgba(0,0,0,.8)]"
                      : "text-white/65 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg transition-colors",
                      active ? "bg-[#FF5500] text-white" : "bg-white/7 group-hover:bg-white/12",
                    )}
                  >
                    <item.icon className="size-4" aria-hidden />
                  </span>
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto grid min-w-0 grid-cols-1 gap-3">
            {/* <Link
              href="/"
              className="flex min-w-0 items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span className="truncate">Visit DropX website</span>
              <ArrowUpRightIcon className="size-4" aria-hidden />
            </Link> */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#FF5500] text-sm font-bold text-white">
                  {(customer?.name || customer?.phone || "D").trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {customer?.name || "DropX customer"}
                  </p>
                  <p className="truncate text-xs text-white/45">
                    {customer?.email || customer?.phone || "Verified account"}
                  </p>
                </div>
              </div>
              <LoadingButton
                variant="ghost"
                size="sm"
                className="mt-3 w-full min-w-0 justify-start text-white/60 hover:bg-white/8 hover:text-white"
                onClick={onSignOut}
                loading={signingOut}
              >
                <LogOutIcon aria-hidden />
                Sign out
              </LoadingButton>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-40 border-b border-black/5 bg-[#F7F8FA]/90 backdrop-blur-xl lg:hidden">
          <div className="flex h-16 items-center gap-3 px-4">
            <Link href="/dashboard" className="text-foreground shrink-0">
              <DropXLogo size="sm" />
            </Link>
            <span className="ml-auto flex size-8 items-center justify-center rounded-lg bg-[#0D0F12] text-xs font-bold text-white">
              {(customer?.name || customer?.phone || "D").trim().charAt(0).toUpperCase()}
            </span>
            <LoadingButton variant="ghost" size="sm" onClick={onSignOut} loading={signingOut}>
              <LogOutIcon aria-hidden />
              <span className="sr-only sm:not-sr-only">Sign out</span>
            </LoadingButton>
          </div>
          <nav
            className="flex items-center gap-1 overflow-x-auto px-4 pb-3 text-sm font-medium"
            aria-label="Customer portal"
          >
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 whitespace-nowrap transition-colors",
                    active
                      ? "bg-[#0D0F12] text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-white",
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>

        <main
          id="portal-content"
          className="max-w-page relative isolate mx-auto w-full flex-1 overflow-hidden px-4 py-8 sm:px-6 lg:px-8 lg:py-10 xl:px-10"
        >
          <div className="pointer-events-none absolute top-0 right-0 -z-10 h-96 w-96 translate-x-1/3 -translate-y-1/3 rounded-full bg-[#FF5500]/8 blur-3xl" />
          {children}
        </main>

        <footer className="px-4 pb-6 sm:px-6 lg:px-8 xl:px-10">
          <div className="text-muted-foreground max-w-page mx-auto flex w-full items-center justify-between border-t border-black/6 pt-5 text-xs">
            <p>DropX customer portal</p>
            <Link href="/" className="hover:text-foreground font-medium transition-colors">
              Back to site
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}

function PortalSkeleton() {
  return (
    <div className="max-w-page mx-auto w-full px-4 py-8" aria-busy="true" aria-live="polite">
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="grid gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
      <span className="sr-only">Checking your session</span>
    </div>
  )
}
