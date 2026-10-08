import { Button, Card, CardContent, cn } from "@dropx/ui"
import { CheckIcon, MapPinIcon, PencilIcon, StarIcon, Trash2Icon } from "lucide-react"
import * as React from "react"

import type { CustomerAddress } from "@/lib/types"

/**
 * The one saved-address card, shared by the address book and the booking
 * wizard's address step, so a saved place looks identical wherever it appears.
 *
 * The two screens differ only in what the card is *for*. The address book
 * offers edit and delete; booking offers selection instead of delete — pass
 * `onSelect` and the whole surface becomes the picker, with `onEdit` as the
 * only action left on it.
 */
export function SavedAddressCard({
  address,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
}: {
  address: CustomerAddress
  /** Booking: highlights the card whose values the form currently holds. */
  selected?: boolean
  /** Booking: selecting the card fills that end of the form. */
  onSelect?: () => void
  onEdit: () => void
  /** Address book only — a booking never deletes from the step it is picking in. */
  onDelete?: () => void
}) {
  const selectable = Boolean(onSelect)

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!onSelect || event.target !== event.currentTarget) return
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    onSelect()
  }

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden py-0",
        selectable &&
          "focus-visible:outline-primary cursor-pointer transition hover:border-black/10 focus-visible:outline-2",
        selected && "border-primary ring-primary/40 ring-2",
      )}
      {...(selectable
        ? {
            role: "radio",
            "aria-checked": selected,
            tabIndex: 0,
            onClick: onSelect,
            onKeyDown,
          }
        : {})}
    >
      <CardContent className="grid gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
              )}
            >
              <MapPinIcon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{address.label || "Saved address"}</p>
              {address.isDefault ? (
                <p className="text-primary flex items-center gap-1 text-xs font-medium">
                  <StarIcon className="size-3" aria-hidden />
                  Default
                </p>
              ) : null}
              {selected ? (
                <p className="text-primary flex items-center gap-1 text-xs font-medium">
                  <CheckIcon className="size-3" aria-hidden />
                  Selected
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Edit ${address.label || "address"}`}
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
            >
              <PencilIcon />
            </Button>
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Delete ${address.label || "address"}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2Icon />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="text-muted-foreground grid gap-1 text-sm">
          <p className="break-words">{address.addressLine}</p>
          <p className="break-words">
            {[address.areaName, address.zoneName, address.cityName].filter(Boolean).join(", ")}
          </p>
          {address.landmark ? <p className="break-words">Landmark — {address.landmark}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}
