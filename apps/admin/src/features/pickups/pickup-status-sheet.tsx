import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  AppToast,
  BoundFormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@dropx/ui"
import { PICKUP_TRANSITIONS } from "@dropx/types"

import { FormSheet } from "@/components/form-sheet"
import { updatePickupStatus } from "@/lib/endpoints"
import type { Pickup, UpdatePickupStatusBody } from "@/lib/types"
import { updatePickupStatusSchema } from "@/lib/types"
import { PICKUP_STATUS_LABEL } from "./pickup-status"

const NEEDS_REASON: ReadonlySet<Pickup["status"]> = new Set(["FAILED", "CANCELLED"])

/**
 * Move a pickup along its lifecycle.
 *
 * One sheet for every move rather than a row of buttons, because the legal moves
 * differ per status and a row that showed the same three buttons everywhere would
 * have to disable most of them at any time. Here the dropdown is built from
 * `PICKUP_TRANSITIONS` — the same table the API enforces — so an impossible move
 * is never offered, and the reason field only appears for the statuses that need
 * one.
 *
 * `PICKED_UP` is the move with teeth: it also moves the parcel, and the customer
 * sees that immediately. The description says so on the option rather than after
 * the fact.
 */
export function PickupStatusSheet({
  open,
  onOpenChange,
  pickup,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pickup: Pickup | null
}) {
  const queryClient = useQueryClient()

  const nextStatuses: readonly Pickup["status"][] = pickup ? PICKUP_TRANSITIONS[pickup.status] : []
  const needsReason = pickup ? NEEDS_REASON.has(pickup.status) : false

  const mutation = useMutation({
    mutationFn: (body: UpdatePickupStatusBody) => updatePickupStatus(pickup!.id, body),
    onSuccess: () => {
      AppToast.success("Pickup updated")
      void queryClient.invalidateQueries({ queryKey: ["pickups"] })
      onOpenChange(false)
    },
  })

  const firstStatus = nextStatuses[0]
  if (!pickup || !firstStatus) return null

  const defaults: z.infer<typeof updatePickupStatusSchema> = { status: firstStatus, reason: "" }

  return (
    <FormSheet
      schema={updatePickupStatusSchema}
      open={open}
      onOpenChange={onOpenChange}
      title="Update pickup"
      description={`Currently ${PICKUP_STATUS_LABEL[pickup.status].toLowerCase()}.`}
      submitLabel="Save status"
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{ status: "New status", reason: "Reason" }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof updatePickupStatusSchema>
        await mutation.mutateAsync({
          status: typed.status,
          reason: typed.reason?.trim() ? typed.reason.trim() : null,
        })
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {nextStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {PICKUP_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Reason{" "}
                  {needsReason ? "" : "(optional — only failures and cancellations need one)"}
                </FormLabel>
                <Textarea
                  rows={2}
                  placeholder={
                    needsReason
                      ? "Customer not home, address unreachable…"
                      : "Anything worth recording"
                  }
                  {...field}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    />
  )
}
