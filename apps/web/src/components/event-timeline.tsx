import { StatusBadge, cn } from "@dropx/ui"
import { Box } from "lucide-react"
import type * as React from "react"

import { eventTypeLabel, formatDateTime } from "@/lib/format"
import type { ParcelEventSummary } from "@/lib/types"

/**
 * The tracking history both the public lookup and the customer's own parcel
 * detail render. The API returns events newest-first, and the list is reversed
 * here rather than at each call site so a customer's eye always travels down
 * from "now".
 */
export function EventTimeline({
  events,
  emptyLabel = "No tracking events recorded yet.",
  className,
}: {
  events: ParcelEventSummary[]
  emptyLabel?: string
  className?: string
}) {
  if (events.length === 0) {
    return <p className={cn("text-muted-foreground text-sm", className)}>{emptyLabel}</p>
  }

  const ordered = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <ol className={cn("relative flex flex-col gap-0", className)}>
      {ordered.map((event, index) => (
        <li
          key={`${event.eventType}-${event.createdAt}-${index}`}
          className="relative flex gap-4 pb-6 last:pb-0"
        >
          <div className="flex flex-col items-center">
            /* * The newest event carries the Volt mark, so "where is this parcel * right now" is
            answered by the eye before the label is read. */
            <span
              className={
                index === 0
                  ? "bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
                  : "bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
              }
            >
              <Box className="size-4" aria-hidden />
            </span>
            {index < ordered.length - 1 ? (
              <span className="bg-border w-px flex-1" aria-hidden />
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{eventTypeLabel(event.eventType)}</span>
              <StatusBadge status={event.eventType} />
            </div>
            <p className="text-muted-foreground text-xs">
              {formatDateTime(event.createdAt)}
              {event.location ? ` · ${event.location}` : null}
            </p>
            {event.description ? <p className="text-sm break-words">{event.description}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
