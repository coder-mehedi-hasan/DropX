import type { ApiErrorCode, ApiErrorEnvelope, ApiFieldIssue, TokenPair } from "@/lib/types"

/**
 * Transport for the DropX API.
 *
 * The portal holds its session in `localStorage` rather than a server session,
 * so the bearer token has to be attached here for every call, and an expired
 * access token has to be exchanged in place rather than bounced through a login
 * redirect. Refresh is attempted exactly once per request: a second 401 after a
 * successful refresh means the session is genuinely dead, not merely stale.
 */

const DEFAULT_API_URL = "http://localhost:8000"

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, "")

const API_PREFIX = "/api/v1"

const ACCESS_TOKEN_KEY = "dropx.web.accessToken"
const REFRESH_TOKEN_KEY = "dropx.web.refreshToken"

export type QueryValue = string | number | boolean | undefined | null

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | string
  readonly details: ApiFieldIssue[]

  constructor(init: {
    status: number
    code: ApiErrorCode | string
    message: string
    details?: ApiFieldIssue[]
  }) {
    super(init.message)
    this.name = "ApiError"
    this.status = init.status
    this.code = init.code
    this.details = init.details ?? []
  }

  /**
   * Field issues collapsed to one message per field, ready for
   * `form.setError`. Issues without a `field` are envelope-level and stay out
   * of the form — they belong in a banner.
   */
  get fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {}
    for (const issue of this.details) {
      if (issue.field && !errors[issue.field]) errors[issue.field] = issue.message
    }
    return errors
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

export type StoredTokens = {
  accessToken: string
  refreshToken: string
}

export function readTokens(): StoredTokens | null {
  if (!isBrowser()) return null

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY)
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!accessToken || !refreshToken) return null

  return { accessToken, refreshToken }
}

export function writeTokens(tokens: TokenPair): void {
  if (!isBrowser()) return

  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function clearTokens(): void {
  if (!isBrowser()) return

  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
}

type SessionExpiredListener = () => void

const sessionExpiredListeners = new Set<SessionExpiredListener>()

/** Lets the auth provider drop its in-memory state when the client gives up. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

function announceSessionExpired(): void {
  for (const listener of sessionExpiredListeners) listener()
}

function toSearchParams(query: Record<string, QueryValue>): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (typeof value === "string" && value.trim() === "") continue
    params.set(key, String(value))
  }

  const serialised = params.toString()
  return serialised ? `?${serialised}` : ""
}

async function readErrorBody(response: Response): Promise<ApiErrorEnvelope | null> {
  try {
    const payload: unknown = await response.json()
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      ((typeof (payload as { error: unknown }).error === "string" && "code" in payload) ||
        (typeof (payload as { error: unknown }).error === "object" &&
          (payload as { error: unknown }).error !== null))
    ) {
      return payload as ApiErrorEnvelope
    }
  } catch {
    /**
     * A non-JSON body (proxy error page, empty 502) is not an envelope.
     */
  }
  return null
}

async function toApiError(response: Response): Promise<ApiError> {
  const envelope = await readErrorBody(response)

  if (!envelope) {
    return new ApiError({
      status: response.status,
      code: "INTERNAL_ERROR",
      message:
        response.status >= 500
          ? "DropX is having trouble right now. Please try again in a moment."
          : `Request failed (${response.status})`,
    })
  }

  if (typeof envelope.error === "string") {
    return new ApiError({
      status: envelope.status ?? response.status,
      code: envelope.code,
      message: envelope.error,
      details: envelope.details,
    })
  }

  // Backward-compatible parsing for an older API error envelope.
  const legacy = envelope.error as unknown as {
    code?: string
    message?: string
    details?: ApiFieldIssue[]
  }
  return new ApiError({
    status: response.status,
    code: legacy.code ?? "INTERNAL_ERROR",
    message: legacy.message ?? "Request failed",
    details: legacy.details,
  })
}

/**
 * Concurrent 401s must not each burn a refresh token — the API rotates nothing,
 * but racing refreshes would hand out two access tokens and race the storage
 * write, so the in-flight exchange is shared.
 */
let refreshInFlight: Promise<TokenPair | null> | null = null

async function refreshSession(): Promise<TokenPair | null> {
  const stored = readTokens()
  if (!stored) return null

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/web/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      })

      if (!response.ok) {
        clearTokens()
        return null
      }

      const payload: unknown = await response.json()
      const tokens =
        typeof payload === "object" && payload !== null && "data" in payload
          ? (payload as { data: TokenPair }).data
          : (payload as TokenPair)
      writeTokens(tokens)
      return tokens
    } catch {
      /**
       * A network blip must not destroy a still-valid refresh token.
       */
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  query?: Record<string, QueryValue>
  body?: unknown
  /** Public endpoints (OTP, public tracking) send no token. */
  auth?: boolean
  signal?: AbortSignal
  /** Internal: marks the single post-refresh replay. */
  allowRefresh?: boolean
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, auth = true, signal, allowRefresh = true } = options

  const headers: Record<string, string> = { Accept: "application/json" }
  if (body !== undefined) headers["Content-Type"] = "application/json"

  if (auth) {
    const stored = readTokens()
    if (stored) headers.Authorization = `Bearer ${stored.accessToken}`
  }

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}${path}${toSearchParams(query ?? {})}`,
    {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    },
  )

  if (response.status === 401 && auth) {
    if (allowRefresh && (await refreshSession())) {
      return apiRequest<T>(path, { ...options, allowRefresh: false })
    }
    /**
     * No usable refresh token, or the replay came back 401 too. Either way the
     */
    /**
     * session is over, and only the auth provider can unwind the UI around it.
     */
    clearTokens()
    announceSessionExpired()
  }

  if (!response.ok) throw await toApiError(response)

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T
  }

  try {
    const payload = (await response.json()) as { data?: T; success?: boolean }
    return (payload && typeof payload === "object" && "data" in payload
      ? payload.data
      : payload) as T
  } catch {
    return undefined as T
  }
}
