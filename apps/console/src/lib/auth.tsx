import { useNavigate, useRouterState } from "@tanstack/react-router"
import { ShieldAlert } from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle, Button, Skeleton } from "@dropx/ui"

import { ApiError, onUnauthorized, readTokens, setTokens } from "./api-client"
import { fetchCurrentStaff, loginWithPassword, logout as logoutRequest } from "./endpoints"
import { isConsolePermission, type PermissionKey } from "./permissions"
import type { StaffIdentity } from "./types"

export type AuthStatus = "loading" | "authenticated" | "anonymous"

type AuthContextValue = {
  status: AuthStatus
  user: StaffIdentity | null
  /** Display name; `/auth/me` carries no name, so login's is kept alongside. */
  displayName: string
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: PermissionKey) => boolean
  hasAnyPermission: (permissions: readonly PermissionKey[]) => boolean
  consolePermissions: readonly string[]
}

const AuthContext = createContext<AuthContextValue | null>(null)

const NAME_STORAGE_KEY = "dropx.console.name"

function readDisplayName(): string {
  return window.localStorage.getItem(NAME_STORAGE_KEY) ?? ""
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [user, setUser] = useState<StaffIdentity | null>(null)
  const [displayName, setDisplayName] = useState<string>(readDisplayName)

  /**
   * Bootstrap.
   *
   * The stored token pair is the only durable session marker, so its presence is
   * what decides whether to ask the API who we are. `/auth/me` is the authority
   * for roles and permissions — nothing is cached from the login response — which
   * keeps a permission revoked mid-session from lingering until the next reload.
   */
  useEffect(() => {
    let active = true

    if (!readTokens()) {
      setStatus("anonymous")
      return
    }

    fetchCurrentStaff()
      .then((identity) => {
        if (!active) return
        setUser(identity)
        setStatus("authenticated")
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.isUnauthenticated) setTokens(null)
        setUser(null)
        setStatus("anonymous")
      })

    return () => {
      active = false
    }
  }, [])

  /**
   * A refresh that fails mid-session must drop the console to the login screen
   * rather than leaving screens rendering against a dead token.
   */
  useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null)
        setStatus("anonymous")
      }),
    [],
  )

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginWithPassword(email, password)
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken })
    window.localStorage.setItem(NAME_STORAGE_KEY, result.account.name)
    setDisplayName(result.account.name)

    try {
      setUser(await fetchCurrentStaff())
      setStatus("authenticated")
    } catch (error) {
      // Credentials were good but the session could not be established; leaving
      // the tokens in place would strand the next reload on a dead session.
      setTokens(null)
      setUser(null)
      setStatus("anonymous")
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => undefined)
    setTokens(null)
    window.localStorage.removeItem(NAME_STORAGE_KEY)
    setUser(null)
    setDisplayName("")
    setStatus("anonymous")
  }, [])

  const granted = useMemo(
    () => new Set((user?.permissions ?? []).filter(isConsolePermission)),
    [user?.permissions],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      displayName: displayName || user?.email || "",
      login,
      logout,
      hasPermission: (permission) => granted.has(permission),
      hasAnyPermission: (permissions) => permissions.some((permission) => granted.has(permission)),
      consolePermissions: [...granted].sort(),
    }),
    [status, user, displayName, login, logout, granted],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>")
  return context
}

/**
 * Route guard.
 *
 * The session is held in React state, not in a router store, so the check is a
 * component rather than `beforeLoad` — a `beforeLoad` here would run before the
 * bootstrap refresh resolves and bounce an authenticated user to `/login` on
 * every hard reload.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const navigate = useNavigate()
  const target = useRouterState({
    select: (state) => state.location.pathname + state.location.searchStr,
  })

  useEffect(() => {
    if (status === "anonymous") {
      void navigate({ to: "/login", search: { redirect: target } })
    }
  }, [status, navigate, target])

  if (status !== "authenticated") return <AuthGateFallback />

  return <>{children}</>
}

/**
 * Permission guard.
 *
 * A missing key is shown as an explicit refusal rather than a hidden screen: a
 * staff member who expected a tab needs to know it is their role, not a bug.
 * The API enforces the same check, so this is presentation, not security.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionKey
  children: ReactNode
}) {
  const { hasPermission, displayName, logout } = useAuth()

  if (!hasPermission(permission)) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10">
        <Alert variant="warning">
          <ShieldAlert />
          <AlertTitle>You do not have access to this screen</AlertTitle>
          <AlertDescription>
            <p>
              Your roles do not include <code className="font-mono text-xs">{permission}</code>. Ask
              an administrator to grant it, or sign in with a different account.
            </p>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              Sign out {displayName ? `(${displayName})` : ""}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}

function AuthGateFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 py-10">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
