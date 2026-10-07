import L from "leaflet"
import "leaflet/dist/leaflet.css"
import * as React from "react"

/**
 * The leaflet half of `MapAddressPicker`, kept in its own module so the map
 * library is only ever evaluated in the browser — leaflet touches `window` the
 * moment it loads, and the parent imports this file with `ssr: false`.
 *
 * The map is uncontrolled: it owns its own camera and reports two things out —
 * a click (a pick) — while the parent's `marker` is the single source of truth
 * for where the pin is.
 */

const DEFAULT_CENTER: L.LatLngTuple = [23.8103, 90.4125]
const DEFAULT_ZOOM = 11
const PINNED_ZOOM = 14

/** Six decimals is ~0.1 m; anything finer is noise the database cannot keep. */
function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

const PIN_ICON = L.divIcon({
  className: "",
  html: '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#FF5500;box-shadow:0 0 0 4px rgba(255,85,0,.28),0 2px 6px rgba(13,15,18,.35)"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

export type LeafletCanvasProps = {
  marker: L.LatLngTuple | null
  onPick: (latitude: number, longitude: number) => void
  height?: number
  className?: string
}

export default function LeafletCanvas({
  marker,
  onPick,
  height = 260,
  className,
}: LeafletCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<L.Map | null>(null)
  const markerRef = React.useRef<L.Marker | null>(null)
  const onPickRef = React.useRef(onPick)
  onPickRef.current = onPick

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const map = L.map(container, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: false,
    })
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    map.on("click", (event: L.LeafletMouseEvent) => {
      onPickRef.current(roundCoordinate(event.latlng.lat), roundCoordinate(event.latlng.lng))
    })
    mapRef.current = map

    // The container can still be measuring on the frame the effect runs.
    const frame = requestAnimationFrame(() => map.invalidateSize())

    return () => {
      cancelAnimationFrame(frame)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!marker) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    if (!markerRef.current) {
      markerRef.current = L.marker(marker, { icon: PIN_ICON, keyboard: false }).addTo(map)
    } else {
      markerRef.current.setLatLng(marker)
    }
    map.flyTo(marker, Math.max(map.getZoom(), PINNED_ZOOM), { duration: 0.35 })
  }, [marker])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height }}
      role="application"
      aria-label="Map — tap to set the location"
    />
  )
}
