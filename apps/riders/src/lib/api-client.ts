/**
 * Typed HTTP client for the DropX API.
 *
 * Everything the rider app sends to `apps/api` goes through `apiRequest`, so
 * bearer tokens, the single refresh-and-retry and the `{ error: { code, message,
 * details } }` envelope are parsed in exactly one place. Feature modules never
 * call `fetch` themselves.
 */

export type ApiErrorDetail = {
  field?: string
  message: string
}

type ErrorEnvelope = {
  error?: {
    code?: string
    message?: string
    details?: ApiErrorDetail[]
  }
}

export class ApiError extends Error {
  override readonly name = "ApiError"

  readonly code: string
  readonly status: number
  readonly details: ApiErrorDetail[]

  constructor(input: {
    code: string
    message: string
    status: number
    details?: ApiErrorDetail[]
  }) {
    super(input.message)
    this.code = input.code
    this.status = input.status
    this.details = input.details ?? []
  }

  get isUnauthenticated(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isOffline(): boolean {
    return this.status === 0
  }

  /** Server-side validation message for one field, if the API sent one. */
  fieldMessage(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.message
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

const NETWORK_ERROR_CODE = "NETWORK_ERROR"

const env = import.meta.env
const API_URL: string =
  typeof env.VITE_API_URL === "string"
    ? env.VITE_API_URL.replace(/\/+$/, "")
    : "http://localhost:3001"

const API_BASE = `${API_URL}/api/v1`

const SESSION_STORAGE_KEY = "dropx.riders.session"

export function getApiUrl(): string {
  return API_URL
}

export type TokenPair = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type StoredSession = TokenPair & {
  /** `users.id` from the login response; `/auth/me` revalidates it on boot. */
  account: {
    id: string
    kind: "rider"
    name: string
    email: string
  }
}

type SessionListener = (session: StoredSession | null) => void

const sessionListeners = new Set<SessionListener>()

let session = readSession()

function readSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredSession(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<StoredSession>
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.refreshToken === "string" &&
    typeof candidate.account === "object" &&
    candidate.account !== null
  )
}

function writeSession(next: StoredSession | null): void {
  session = next
  try {
    if (next) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next))
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  } catch {
    // Private-mode storage failures must not break a delivery session.
  }
  for (const listener of sessionListeners) listener(next)
}

export function getSession(): StoredSession | null {
  return session
}

export function setSession(next: StoredSession | null): void {
  writeSession(next)
}

export function subscribeToSession(listener: SessionListener): () => void {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  /** Attach the bearer token. Public operations leave this off. */
  auth?: boolean
  signal?: AbortSignal
}

type RawResult = {
  status: number
  body: unknown
}

function buildUrl(path: string, query: RequestOptions["query"]): string {
  const url = new URL(`${API_BASE}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function toApiError(status: number, body: unknown): ApiError {
  const envelope = (typeof body === "object" && body !== null ? body : {}) as ErrorEnvelope
  const code = typeof envelope.error?.code === "string" ? envelope.error.code : "UNKNOWN"
  const message =
    typeof envelope.error?.message === "string" && envelope.error.message.length > 0
      ? envelope.error.message
      : "Something went wrong. Please try again."
  const details = Array.isArray(envelope.error?.details) ? envelope.error.details : undefined
  return new ApiError({ code, message, status, ...(details ? { details } : {}) })
}

async function rawRequest(path: string, options: RequestOptions): Promise<RawResult> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (options.body !== undefined) headers["Content-Type"] = "application/json"
  if (options.auth) {
    const token = session?.accessToken
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new ApiError({
      code: NETWORK_ERROR_CODE,
      message: "No connection to DropX. Check your signal and try again.",
      status: 0,
    })
  }

  if (response.status === 204) return { status: response.status, body: null }

  const text = await response.text()
  let body: unknown = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  return { status: response.status, body }
}

let refreshInFlight: Promise<boolean> | null = null

/**
 * Exchanges the refresh token for a new pair.
 *
 * A single in-flight promise is shared by every caller so a screen that fires
 * three queries at once cannot burn three refresh tokens and log the rider out
 * mid-route. A failed refresh clears the session: the access token is gone and
 * there is nothing to recover to.
 */
async function refreshSession(): Promise<boolean> {
  const current = session
  if (!current) return false

  refreshInFlight ??= (async () => {
    try {
      const { status, body } = await rawRequest("/auth/riders/refresh", {
        method: "POST",
        body: { refreshToken: current.refreshToken },
      })
      if (status >= 200 && status < 300 && isTokenPair(body) && session) {
        writeSession({
          accessToken: body.accessToken,
          refreshToken: body.refreshToken,
          expiresIn: body.expiresIn,
          account: session.account,
        })
        return true
      }
      writeSession(null)
      return false
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

function isTokenPair(value: unknown): value is TokenPair {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<TokenPair>
  return typeof candidate.accessToken === "string" && typeof candidate.refreshToken === "string"
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const wantsAuth = options.auth === true
  const first = await rawRequest(path, options)

  if (wantsAuth && first.status === 401 && (await refreshSession())) {
    const retried = await rawRequest(path, options)
    if (retried.status >= 200 && retried.status < 300) return retried.body as T
    throw toApiError(retried.status, retried.body)
  }

  if (first.status >= 200 && first.status < 300) return first.body as T
  throw toApiError(first.status, first.body)
}

/**
 * Retry policy for TanStack Query.
 *
 * A 401/403/404 will fail identically on every retry — retrying them wastes the
 * rider's data and delays the "ask dispatch" message — so only transport and
 * server faults are retried.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && (error.isUnauthenticated || error.isForbidden)) return false
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false
  return failureCount < 2
}
