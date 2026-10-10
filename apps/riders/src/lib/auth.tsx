import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Navigate, useRouterState } from "@tanstack/react-router"

import { ScreenPending } from "../components/feedback"
import {
  apiRequest,
  getSession,
  setSession,
  subscribeToSession,
  type TokenPair,
} from "./api-client"
import type { RiderPermission } from "./permissions"
import { RIDER_PERMISSION_KEYS } from "./permissions"

type LoginInput = {
  email: string
  password: string
}

type LoginResponse = TokenPair & {
  account: {
    id: string
    kind: "rider"
    name: string
    email: string
    avatarUrl?: string | null
    roles: string[]
    mustChangePassword: boolean
  }
}

type RiderMeResponse = {
  kind: "rider"
  audience: string
  id: string
  riderId: string
  hubId: string
  email: string
  avatarUrl: string | null
  permissions: string[]
  mustChangePassword: boolean
}

export type RiderIdentity = {
  id: string
  riderId: string
  hubId: string
  name: string
  email: string
  avatarUrl: string | null
  permissions: RiderPermission[]
  mustChangePassword: boolean
}

type AuthStatus = "loading" | "authenticated" | "anonymous"

type AuthState = {
  status: AuthStatus
  rider: RiderIdentity | null
}

type AuthContextValue = AuthState & {
  login: (input: LoginInput) => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
  logout: () => Promise<void>
  can: (permission: RiderPermission) => boolean
  updateRider: (patch: Partial<Pick<RiderIdentity, "name" | "avatarUrl">>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ANONYMOUS: AuthState = { status: "anonymous", rider: null }

const RIDER_KEYS = new Set<string>(RIDER_PERMISSION_KEYS)

async function loadIdentity(account: { name: string; email: string }): Promise<RiderIdentity> {
  const me = await apiRequest<RiderMeResponse>("/auth/me", { auth: true })
  return {
    id: me.id,
    riderId: me.riderId,
    hubId: me.hubId,
    name: account.name,
    email: me.email,
    avatarUrl: me.avatarUrl,
    permissions: me.permissions.filter((key): key is RiderPermission => RIDER_KEYS.has(key)),
    mustChangePassword: me.mustChangePassword,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    getSession() ? { status: "loading", rider: null } : ANONYMOUS,
  )

  useEffect(() => {
    const session = getSession()
    if (!session) {
      setState(ANONYMOUS)
      return
    }

    let cancelled = false
    void loadIdentity(session.account)
      .then((rider) => {
        if (!cancelled) setState({ status: "authenticated", rider })
      })
      .catch(() => {
        setSession(null)
        if (!cancelled) setState(ANONYMOUS)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () =>
      subscribeToSession((session) => {
        if (!session) setState(ANONYMOUS)
      }),
    [],
  )

  const login = useCallback(async (input: LoginInput) => {
    const result = await apiRequest<LoginResponse>("/auth/riders/login", {
      method: "POST",
      body: { email: input.email.trim().toLowerCase(), password: input.password },
    })

    setSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      account: {
        id: result.account.id,
        kind: "rider",
        name: result.account.name,
        email: result.account.email,
        avatarUrl: result.account.avatarUrl ?? null,
      },
    })

    try {
      setState({ status: "authenticated", rider: await loadIdentity(result.account) })
    } catch (error) {
      setSession(null)
      throw error
    }
  }, [])

  const changePassword = useCallback(async (newPassword: string) => {
    await apiRequest<{ ok: true }>("/auth/riders/password", {
      method: "POST",
      body: { newPassword },
      auth: true,
    })
    const session = getSession()
    if (!session) return
    const rider = await loadIdentity(session.account)
    setState({ status: "authenticated", rider })
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST", auth: true })
    } catch {
      // Access tokens are stateless, so a failed logout call must not trap the
      // rider in an app they have already been signed out of.
    }
    setSession(null)
    setState(ANONYMOUS)
  }, [])

  const updateRider = useCallback(
    (patch: Partial<Pick<RiderIdentity, "name" | "avatarUrl">>) => {
      setState((current) => {
        if (!current.rider) return current
        const next = { ...current.rider, ...patch }
        const session = getSession()
        if (session) {
          setSession({
            ...session,
            account: { ...session.account, name: next.name, avatarUrl: next.avatarUrl },
          })
        }
        return { status: "authenticated", rider: next }
      })
    },
    [],
  )

  const can = useCallback(
    (permission: RiderPermission) => state.rider?.permissions.includes(permission) ?? false,
    [state.rider],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, changePassword, logout, can, updateRider }),
    [state, login, changePassword, logout, can, updateRider],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>")
  return context
}

export function usePermission(permission: RiderPermission): boolean {
  return useAuth().can(permission)
}

/**
 * Route guard for everything a rider signs in to use.
 *
 * It renders a pending state rather than redirecting while the stored session is
 * still being validated, otherwise a reload mid-route would bounce the rider to
 * the login screen and lose the job they had open.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, rider } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (status === "loading") return <ScreenPending label="Checking your session" />
  if (status === "anonymous") return <Navigate to="/login" replace />
  if (rider?.mustChangePassword && pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />
  }
  return <>{children}</>
}
