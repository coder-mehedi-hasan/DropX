import { MapPin, PackageCheck } from "lucide-react"
import { EmptyState, EventBadge } from "@dropx/ui"

import { formatDateTime } from "@/lib/format"
import type { ParcelEventSummary } from "@/lib/types"

/**
 * The tracking history.
 *
 * Newest first, because an ops screen is almost always opened to answer "where
 * is it right now" — and the top of the list is also the only position where a
 * long history is visible without scrolling.
 */
export function EventTimeline({
  events,
  emptyTitle = "No tracking events yet",
  emptyDescription = "Events are written as the parcel moves through pickup, hubs and last-mile delivery.",
}: {
  events: readonly ParcelEventSummary[]
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (events.length === 0) {
    return <EmptyState icon={PackageCheck} title={emptyTitle} description={emptyDescription} />
  }

  const ordered = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <ol className="relative space-y-4 pl-6">
      <span className="bg-border absolute top-1 bottom-1 left-[7px] w-px" aria-hidden />
      {ordered.map((event, index) => (
        <li key={`${event.eventType}-${event.createdAt}-${index}`} className="relative">
          <span
            className={
              index === 0
                ? "bg-primary ring-background absolute top-1.5 -left-6 size-[9px] rounded-full ring-2"
                : "bg-background ring-border absolute top-1.5 -left-6 size-[9px] rounded-full ring-2"
            }
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-2">
            <EventBadge eventType={event.eventType} />
            <time
              className="text-muted-foreground text-xs"
              dateTime={new Date(event.createdAt).toISOString()}
            >
              {formatDateTime(event.createdAt)}
            </time>
          </div>
          {event.description ? <p className="mt-1 text-sm">{event.description}</p> : null}
          {event.location ? (
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              <MapPin className="size-3" />
              {event.location}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
