"use client"

import { MapPinIcon, SearchIcon, XIcon } from "lucide-react"
import dynamic from "next/dynamic"
import * as React from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  cn,
} from "@dropx/ui"

const LeafletCanvas = dynamic(() => import("./leaflet-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full rounded-xl" />,
})

/**
 * The reusable "pick it on a map" address control. The form only ever shows a
 * one-line trigger (pinned coords, or the empty hint); search and the map live
 * in a modal so a long address form is not taken over by a map tile canvas.
 *
 * The map itself lives in `leaflet-canvas.tsx` and is loaded with `ssr: false`;
 * leaflet reads `window` at import time and must never run during prerender.
 * Modal edits commit immediately — no draft state — so closing with Escape or
 * the overlay simply keeps whatever pin is already set.
 *
 * It owns only the coordinates — the parent keeps them in its own form fields —
 * plus an optional callback with the chosen place's name, so an address line can
 * be pre-filled without this component ever seeing the form.
 */

export type MapPoint = {
  latitude: number
  longitude: number
}

type SearchResult = {
  name: string
  latitude: number
  longitude: number
}

type MapAddressPickerProps = {
  value: MapPoint | null
  onChange: (point: MapPoint | null) => void
  /** Fired with a search result's display name; the parent decides whether to use it. */
  onSuggestAddress?: (addressLine: string) => void
  label?: string
  emptyHint?: string
  height?: number
  className?: string
}

const SEARCH_DEBOUNCE_MS = 600
const MIN_QUERY_LENGTH = 3
const MAX_RESULTS = 5
/** Nominatim's display names are long; the booking address line stops at 300. */
const ADDRESS_SUGGESTION_MAX = 300

async function searchPlaces(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("limit", String(MAX_RESULTS))
  url.searchParams.set("q", query)

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Search failed with ${response.status}`)

  const rows = (await response.json()) as { display_name?: string; lat?: string; lon?: string }[]
  return rows.flatMap((row) => {
    const latitude = Number(row.lat)
    const longitude = Number(row.lon)
    if (!row.display_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
    return [{ name: row.display_name, latitude, longitude }]
  })
}

export default function MapAddressPicker({
  value,
  onChange,
  onSuggestAddress,
  label = "Pin the exact spot",
  emptyHint = "Pick a location on the map.",
  height = 320,
  className,
}: MapAddressPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)

  // A fresh tuple every render would restart the canvas's fly-to effect on
  // every keystroke anywhere on the page; the coordinates are the real dep.
  const marker = React.useMemo<[number, number] | null>(
    () => (value ? [value.latitude, value.longitude] : null),
    [value?.latitude, value?.longitude],
  )

  React.useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([])
      setSearchError(null)
      setSearching(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearching(true)
      setSearchError(null)
      searchPlaces(trimmed, controller.signal)
        .then((found) => setResults(found))
        .catch(() => {
          if (controller.signal.aborted) return
          setResults([])
          setSearchError("Search is unavailable right now — tap the map instead.")
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function chooseResult(result: SearchResult) {
    onChange({ latitude: result.latitude, longitude: result.longitude })
    onSuggestAddress?.(result.name.slice(0, ADDRESS_SUGGESTION_MAX))
    setResults([])
    setQuery(result.name)
    setSearchError(null)
  }

  return (
    <div className={cn("grid gap-2.5", className)}>
      <p className="text-sm font-medium">{label}</p>

      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="focus-visible:ring-accent-ink flex flex-1 items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 text-left ring-1 ring-black/8 transition hover:ring-[#FF5500]/40 focus-visible:ring-2 focus-visible:outline-none"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              value ? "bg-[#FFF0EB] text-[#E64D00]" : "text-muted-foreground bg-[#F1F3F6]",
            )}
          >
            <MapPinIcon className="size-4" aria-hidden />
          </span>
          <span className="grid flex-1 gap-0.5">
            <span className="text-sm font-medium">
              {value ? "Location pinned" : "Open map to pin"}
            </span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {value ? `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}` : emptyHint}
            </span>
          </span>
        </button>

        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Clear pin"
            className="text-muted-foreground hover:text-destructive hover:ring-destructive/40 focus-visible:ring-accent-ink flex shrink-0 items-center justify-center rounded-xl bg-white px-3 ring-1 ring-black/8 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              Search a place, then tap the map to set the exact spot.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a place — area, road or building"
              className="pl-9"
              autoComplete="off"
              aria-label="Search a place on the map"
            />
            {results.length > 0 ? (
              <ul className="bg-background absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl shadow-[0_18px_40px_-24px_rgba(13,15,18,.45)] ring-1 ring-black/10">
                {results.map((result) => (
                  <li key={`${result.latitude},${result.longitude}`}>
                    <button
                      type="button"
                      onClick={() => chooseResult(result)}
                      className="block w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#F7F8FA]"
                    >
                      <span className="line-clamp-2 leading-5">{result.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {searching ? (
            <p className="text-muted-foreground text-xs">Searching…</p>
          ) : searchError ? (
            <p className="text-destructive text-xs">{searchError}</p>
          ) : null}

          <div className="overflow-hidden rounded-xl ring-1 ring-black/8">
            <LeafletCanvas
              marker={marker}
              onPick={(latitude, longitude) => onChange({ latitude, longitude })}
              height={height}
              className="h-full w-full"
            />
          </div>

          <p className="text-muted-foreground text-xs">
            {value ? (
              <span className="font-medium tabular-nums">
                <MapPinIcon className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
                {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
              </span>
            ) : (
              emptyHint
            )}
          </p>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(null)}
              disabled={!value}
            >
              Clear pin
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
