import { MapPin } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { apiRequest } from "../../lib/api-client"
import { usePermission } from "../../lib/auth"
import { RIDER_PERMISSIONS } from "../../lib/permissions"

/**
 * Live location push.
 *
 * The rider app reports where they are so dispatch can see the fleet. Two
 * decisions are worth knowing about:
 *
 * **The interval is slow.** A rider app is on a phone that may be on mobile data,
 * and the trail is a log rather than a live stream — dispatch reads the latest
 * fix, not a path. Pushing every few seconds would spend the rider's battery and
 * data allowance to write rows nobody reads at that resolution.
 *
 * **Nothing is retried into the past.** A push that fails while the app is in a
 * dead spot is dropped rather than queued: a fix from twenty minutes ago
 * presented as current is worse than no fix at all, because it looks live.
 */

export const LOCATION_PUSH_INTERVAL_MS = 120_000

export type LocationFix = {
  latitude: number
  longitude: number
}

export type LocationPushState = "idle" | "starting" | "active" | "unavailable" | "denied"

/**
 * Reads a position once.
 *
 * Split out from the interval so the permission prompt happens on one deliberate
 * user action rather than on mount — a browser or OS that asks for location the
 * moment an app opens gets denied, and then never offers again.
 */
function readPosition(): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This device cannot report a location"))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => reject(new Error(error.message || "Could not read your location")),
      {
        // A fix from a moving rider is only useful if it is reasonably current,
        // and a cached position would be reported as if it were live.
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 30_000,
      },
    )
  })
}

export function useLocationPush() {
  const canPush = usePermission(RIDER_PERMISSIONS.LOCATION_UPDATE)
  const [state, setState] = useState<LocationPushState>("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!canPush) {
      setState("denied")
      return
    }

    let cancelled = false

    const push = async () => {
      try {
        const fix = await readPosition()
        if (cancelled) return
        await apiRequest("/jobs/locations", { auth: true, method: "POST", body: fix })
      } catch {
        // A denial and a dead spot are the same thing from here: no fix this
        // round. The rider decides whether to keep going, so this is not an
        // error state — only "unavailable" so the UI can say so plainly.
        if (!cancelled) setState("unavailable")
        return
      }

      if (cancelled) return
      setState("active")

      timer.current = setTimeout(() => {
        void push()
      }, LOCATION_PUSH_INTERVAL_MS)
    }

    setState("starting")
    void push()

    return () => {
      cancelled = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [canPush])

  return { state, canPush }
}

const STATUS_COPY: Record<LocationPushState, { label: string; detail: string }> = {
  idle: {
    label: "Location off",
    detail: "Dispatch cannot see where you are.",
  },
  starting: {
    label: "Finding you…",
    detail: "Asking this device for a position.",
  },
  active: {
    label: "Sharing location",
    detail: "Dispatch can see roughly where you are while you work.",
  },
  unavailable: {
    label: "Location unavailable",
    detail: "Turn on location for this app, then pull to refresh.",
  },
  denied: {
    label: "Location not shared",
    detail:
      "Your account is missing the rider.location.update permission. Ask dispatch to grant it.",
  },
}

/**
 * Says plainly whether the push is working, and says nothing when it is not
 * relevant. A rider who cannot see this indicator has no way to know dispatch is
 * tracking them, and one who cannot turn it off has no way to find out.
 */
export function LocationPushStatus({
  state,
  canPush,
}: {
  state: LocationPushState
  canPush: boolean
}) {
  if (!canPush) return null

  const copy = STATUS_COPY[state]

  return (
    <p className="text-muted-foreground flex items-center justify-center gap-2 text-center text-xs">
      <MapPin aria-hidden className="size-3.5" />
      <span className="font-medium">{copy.label}</span>
      <span>·</span>
      <span>{copy.detail}</span>
    </p>
  )
}
