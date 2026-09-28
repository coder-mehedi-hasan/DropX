import { DEFAULT_PARCELS_SEARCH } from "./parcels"
import { parcelsSearchSchema } from "@/routes/search-params"

/**
 * Where a signed-in user may be sent after login.
 *
 * The router is declared in code, so `navigate({ to })` only accepts a known
 * route id — an arbitrary `redirect` string from the URL cannot be handed to it
 * unchecked. Resolving the path here keeps the login screen's "return me where I
 * was" behaviour without either a cast or an open-redirect: a path that is not
 * one of these three falls back to the dashboard.
 */
export type ConsoleDestination =
  | { to: "/" }
  | { to: "/parcels"; search: ReturnType<typeof resolveParcelSearch> }
  | { to: "/parcels/$parcelId"; params: { parcelId: string } }
  | { to: "/tracking"; search: { tracking: string } }

const PARCEL_ID = /^[A-Za-z0-9_-]{1,64}$/

export function resolveRedirect(raw: string | undefined): ConsoleDestination {
  if (!raw || !raw.startsWith("/")) return { to: "/" }

  const url = new URL(raw, "http://console.invalid")
  const path = url.pathname

  if (path === "/") return { to: "/" }

  if (path === "/parcels") {
    return { to: "/parcels", search: resolveParcelSearch(url.searchParams) }
  }

  if (path.startsWith("/parcels/")) {
    const parcelId = decodeURIComponent(path.slice("/parcels/".length))
    if (PARCEL_ID.test(parcelId)) return { to: "/parcels/$parcelId", params: { parcelId } }
    return { to: "/" }
  }

  if (path === "/tracking") {
    const tracking = url.searchParams.get("tracking")?.trim() ?? ""
    return tracking
      ? { to: "/tracking", search: { tracking } }
      : { to: "/tracking", search: { tracking: "" } }
  }

  return { to: "/" }
}

/** The list URL is the only place a hand-edited query string can arrive from. */
function resolveParcelSearch(params: URLSearchParams) {
  const parsed = parcelsSearchSchema.safeParse({
    page: params.get("page") ?? undefined,
    limit: params.get("limit") ?? undefined,
    sortBy: params.get("sortBy") ?? undefined,
    sort: params.get("sort") ?? undefined,
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
    paymentType: params.get("paymentType") ?? undefined,
    hubId: params.get("hubId") ?? undefined,
  })

  if (!parsed.success) return DEFAULT_PARCELS_SEARCH
  return parsed.data
}
