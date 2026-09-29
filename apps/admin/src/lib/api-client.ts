/**
 * Typed transport for the DropX API.
 *
 * The API is always addressed absolutely — there is no dev proxy — so the only
 * thing this wrapper adds over `fetch` is the session: a bearer token, ONE
 * transparent refresh on 401, and a typed `ApiError` so every screen can branch
 * on `code` instead of re-parsing the envelope.
 *
 * Every API operation answers with one envelope —
 * `{ error, data, status, success, code }` — so unwrapping `data` and reading
 * the flat `error` / `code` / `details` happen here, once, and every call site
 * above sees the payload it asked for.
 */

const DEFAULT_API_URL = "http://localhost:8000"
const API_PREFIX = "/api/v1"

/** Admin tokens are audience-bound; the refresh path must match the login path. */
const AUDIENCE = "admin"

/** A trailing slash in `VITE_API_URL` would double up on every path. */
export const API_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) || DEFAULT_API_URL
).replace(/\/+$/, "")

export type ApiFieldError = { field?: string; message: string }

/**
 * Every non-2xx API answer, and every answer the network refused to give.
 *
 * `code` is the API's stable string (`UNAUTHENTICATED`, `MISSING_PERMISSION`,
 * `VALIDATION_FAILED`, …) so callers switch on it rather than on a status code;
 * `details` is what gets mapped onto form fields.
 */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: ApiFieldError[]

  constructor(input: { code: string; message: string; status: number; details?: ApiFieldError[] }) {
    super(input.message)
    this.name = "ApiError"
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
}

type Tokens = { accessToken: string; refreshToken: string }

type QueryValue = string | number | boolean | null | undefined

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  /** Omit for GET and for requests with no body. */
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
  /** Public routes skip the bearer token and the refresh dance. */
  anonymous?: boolean
}

type TokenStore = {
  read: () => Tokens | null
  write: (tokens: Tokens | null) => void
}

const TOKEN_STORAGE_KEY = "dropx.admin.tokens"

function browserTokenStore(): TokenStore {
  return {
    read: () => {
      const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY)
      if (!raw) return null
      try {
        const parsed: unknown = JSON.parse(raw)
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "accessToken" in parsed &&
          "refreshToken" in parsed &&
          typeof (parsed as Tokens).accessToken === "string" &&
          typeof (parsed as Tokens).refreshToken === "string"
        ) {
          return parsed as Tokens
        }
        return null
      } catch {
        return null
      }
    },
    write: (tokens) => {
      if (tokens) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
      } else {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY)
      }
    },
  }
}

let tokenStore: TokenStore | null = null

function tokens(): TokenStore {
  tokenStore ??= browserTokenStore()
  return tokenStore
}

const unauthorizedListeners = new Set<() => void>()

/**
 * Lets the auth layer drop the session when a refresh fails. Registered as a
 * listener rather than imported to keep this module free of React.
 */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

function announceUnauthorized(): void {
  for (const listener of unauthorizedListeners) listener()
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${API_URL}${API_PREFIX}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

type ApiEnvelope<T> = {
  error: string | null
  data: T
  status: number
  success: boolean
  code: string
  details?: ApiFieldError[]
}

/** True for the one envelope shape the API sends, so a bare body still passes through. */
function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "success" in value &&
    "code" in value
  )
}

async function readErrorBody(
  response: Response,
): Promise<{ code: string; message: string; details: ApiFieldError[] }> {
  const fallback = {
    code: "HTTP_ERROR",
    message: response.statusText || "Request failed",
    details: [] as ApiFieldError[],
  }

  try {
    const body: unknown = await response.json()
    if (!isEnvelope(body)) return fallback

    return {
      code: typeof body.code === "string" ? body.code : "HTTP_ERROR",
      message: typeof body.error === "string" && body.error ? body.error : fallback.message,
      details: Array.isArray(body.details)
        ? body.details.filter(
            (entry): entry is ApiFieldError =>
              typeof entry === "object" &&
              entry !== null &&
              typeof (entry as ApiFieldError).message === "string",
          )
        : [],
    }
  } catch {
    return fallback
  }
}

async function parseError(response: Response): Promise<ApiError> {
  const body = await readErrorBody(response)
  return new ApiError({
    code: body.code,
    message: body.message,
    status: response.status,
    details: body.details,
  })
}

async function send<T>(
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (options.body !== undefined) headers["Content-Type"] = "application/json"

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    signal: options.signal,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })

  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T

  const body: unknown = await response.json()
  return (isEnvelope(body) ? body.data : body) as T
}

/**
 * Single-flight refresh.
 *
 * An admin screen fires several queries at once, so an expired access token
 * produces a burst of 401s. Without this latch every request would spend its own
 * refresh token and the later ones would fail on a rotated session.
 */
let refreshInFlight: Promise<Tokens | null> | null = null

async function refreshTokens(): Promise<Tokens | null> {
  const current = tokens().read()
  if (!current) return null

  try {
    const pair = await send<Partial<Tokens>>(
      `/auth/${AUDIENCE}/refresh`,
      { method: "POST", body: { refreshToken: current.refreshToken }, anonymous: true },
      null,
    )
    // The API rotates the refresh token too, so the old one must be replaced
    // rather than kept — otherwise the next refresh presents an expired token.
    const next: Tokens = {
      accessToken: pair.accessToken ?? current.accessToken,
      refreshToken: pair.refreshToken ?? current.refreshToken,
    }
    tokens().write(next)
    return next
  } catch {
    return null
  }
}

function refreshOnce(): Promise<Tokens | null> {
  refreshInFlight ??= refreshTokens().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.anonymous) return send<T>(path, options, null)

  const accessToken = tokens().read()?.accessToken ?? null
  try {
    return await send<T>(path, options, accessToken)
  } catch (error) {
    if (!(error instanceof ApiError) || !error.isUnauthenticated || !accessToken) throw error

    const refreshed = await refreshOnce()
    if (!refreshed) {
      tokens().write(null)
      announceUnauthorized()
      throw error
    }

    try {
      return await send<T>(path, options, refreshed.accessToken)
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.isUnauthenticated) {
        tokens().write(null)
        announceUnauthorized()
      }
      throw retryError
    }
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
}

export function setTokens(next: Tokens | null): void {
  tokens().write(next)
}

export function readTokens(): Tokens | null {
  return tokens().read()
}
