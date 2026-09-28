"use client"

import { Alert, AlertDescription, AlertTitle, Button, DropXLogo, Skeleton, cn } from "@dropx/ui"
import { LogOutIcon, PackageIcon, PlusIcon, SearchIcon } from "lucide-react"
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
  { href: "/track", label: "Track", icon: SearchIcon },
] as const

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { customer, signOut } = useAuth()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = React.useState(false)

  async function onSignOut() {
    setSigningOut(true)
    await signOut()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-page items-center gap-4 px-4">
          <Link href="/dashboard" className="text-foreground hover:text-foreground shrink-0">
            <DropXLogo size="sm" />
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-medium sm:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                    active
                      ? "bg-primary/10 text-accent-ink"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {customer?.name || customer?.phone || "Signed in"}
            </span>
            <Button variant="outline" size="sm" onClick={onSignOut} disabled={signingOut}>
              <LogOutIcon aria-hidden />
              Sign out
            </Button>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t px-4 py-2 text-sm font-medium sm:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary/10 text-accent-ink"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-page flex-1 px-4 py-8">{children}</main>

      <footer className="bg-card border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-page items-center justify-between px-4 py-6 text-sm">
          <p>DropX customer portal</p>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Back to site</Link>
          </Button>
        </div>
      </footer>
    </div>
  )
}

function PortalSkeleton() {
  return (
    <div className="mx-auto w-full max-w-page px-4 py-8" aria-busy="true" aria-live="polite">
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
