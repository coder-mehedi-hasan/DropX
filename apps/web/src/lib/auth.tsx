"use client"

import { useRouter } from "next/navigation"
import * as React from "react"

import { authApi } from "@/lib/api"
import {
  ApiError,
  clearTokens,
  isApiError,
  onSessionExpired,
  readTokens,
  writeTokens,
} from "@/lib/api-client"
import type { CustomerSession, SessionCustomer, TokenPair } from "@/lib/types"

/**
 * Client-side customer session.
 *
 * DropX customers have no password, so there is nothing to put in a cookie and
 * nothing for the server to validate on first paint: the portal renders, then
 * hydrates, then discovers whether an ACTIVE customer is present. `unavailable`
 * is a state of its own because a 500 from the API must not be mistaken for a
 * missing session and throw the customer back to the OTP screen mid-checkout.
 */

const CUSTOMER_KEY = "dropx.web.customer"

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "unavailable"

export type AuthContextValue = {
  status: AuthStatus
  customer: SessionCustomer | null
  signIn: (session: CustomerSession) => void
  signOut: () => Promise<void>
  /**
   * Merges profile edits (name, avatar) into the cached session and persists
   * them, so the shell's identity card updates without a sign-out/in.
   */
  updateCustomer: (patch: Partial<Pick<SessionCustomer, "name" | "avatarUrl">>) => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

function readStoredCustomer(): SessionCustomer | null {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(CUSTOMER_KEY)
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    const customer = parsed as Partial<SessionCustomer>
    if (typeof customer.id !== "string" || typeof customer.name !== "string") return null
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? null,
      status: "ACTIVE",
      avatarUrl: typeof customer.avatarUrl === "string" ? customer.avatarUrl : null,
    }
  } catch {
    return null
  }
}

function writeStoredCustomer(customer: SessionCustomer | null): void {
  if (typeof window === "undefined") return

  if (customer) {
    window.localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer))
    return
  }
  window.localStorage.removeItem(CUSTOMER_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = React.useState<AuthStatus>("loading")
  const [customer, setCustomer] = React.useState<SessionCustomer | null>(null)

  const adopt = React.useCallback((next: SessionCustomer | null) => {
    setCustomer(next)
    writeStoredCustomer(next)
    setStatus(next ? "authenticated" : "anonymous")
  }, [])

  React.useEffect(() => {
    let cancelled = false

    if (!readTokens()) {
      adopt(null)
      return () => {
        cancelled = true
      }
    }

    void authApi
      .me()
      .then((me) => {
        if (cancelled) return

        /**
         * A TEMP customer holds a valid token but may not use the portal.
         */
        if (me.kind !== "customer" || me.audience !== "web" || me.status !== "ACTIVE") {
          clearTokens()
          adopt(null)
          return
        }

        const stored = readStoredCustomer()
        if (stored && stored.id === me.id) {
          setCustomer(stored)
          setStatus("authenticated")
          return
        }
        /**
         * Tokens survived but the cached profile did not; the shape is known
         */
        /**
         * from `me`, so the shell can render while a full profile is absent.
         */
        setCustomer({
          id: me.id,
          name: "",
          phone: "",
          email: null,
          status: "ACTIVE",
        })
        setStatus("authenticated")
      })
      .catch((error: unknown) => {
        if (cancelled) return

        if (isApiError(error) && (error.status === 401 || error.status === 403)) {
          clearTokens()
          adopt(null)
          return
        }

        setStatus("unavailable")
      })

    return () => {
      cancelled = true
    }
  }, [adopt])

  React.useEffect(
    () =>
      onSessionExpired(() => {
        adopt(null)
        router.replace("/login")
      }),
    [adopt, router],
  )

  const signIn = React.useCallback(
    (session: CustomerSession) => {
      const tokens: TokenPair = {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      }
      writeTokens(tokens)
      adopt(session.customer)
    },
    [adopt],
  )

  const signOut = React.useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      /**
       * Access tokens are stateless; a failed logout must not strand the user
       */
      /**
       * in a signed-in shell.
       */
      if (!isApiError(error)) throw error
    } finally {
      clearTokens()
      adopt(null)
      router.replace("/")
    }
  }, [adopt, router])

  const updateCustomer = React.useCallback(
    (patch: Partial<Pick<SessionCustomer, "name" | "avatarUrl">>) => {
      setCustomer((current) => {
        if (!current) return current
        const next = { ...current, ...patch }
        writeStoredCustomer(next)
        return next
      })
    },
    [],
  )

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, customer, signIn, signOut, updateCustomer }),
    [status, customer, signIn, signOut, updateCustomer],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>")
  return context
}

export { ApiError }
