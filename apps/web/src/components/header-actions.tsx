"use client"

import { Button, Separator } from "@dropx/ui"
import Link from "next/link"

import { useAuth } from "@/lib/auth"

/**
 * The header's action pair, the one part of the marketing chrome that knows
 * whether there is a session. It lives in its own client module so
 * `SiteHeader` itself stays a server component.
 *
 * Signed out it offers the sign-in link and the booking CTA; signed in it
 * swaps the link for the dashboard and points the CTA at `/book` — sending a
 * signed-in customer to `/login` would only bounce them to `/dashboard`.
 * While the session is still unknown, neither is rendered: the pair has no
 * correct state to show yet.
 */
export function HeaderActions() {
  const { status } = useAuth()
  const signedIn = status === "authenticated"

  return (
    <div className="ml-auto flex items-center gap-2">
      {status === "loading" ? null : signedIn ? (
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      ) : (
        <Button variant="link" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      )}
      {status === "loading" ? null : (
        <>
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <Button asChild>
            <Link href={signedIn ? "/book" : "/login"}>Book a parcel</Link>
          </Button>
        </>
      )}
    </div>
  )
}
