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
import { DELIVERY_TRANSITIONS } from "@dropx/types"

import { FormSheet } from "@/components/form-sheet"
import { updateDeliveryStatus } from "@/lib/endpoints"
import type { DeliveryRow, UpdateDeliveryStatusBody } from "@/lib/types"
import { updateDeliveryStatusSchema } from "@/lib/types"
import { DELIVERY_STATUS_LABEL } from "./delivery-status"

const NEEDS_REASON: ReadonlySet<DeliveryRow["status"]> = new Set(["FAILED", "CANCELLED"])

/**
 * Move a delivery attempt along its lifecycle.
 *
 * Same sheet for every move, because the legal moves differ per status and a
 * row of always-visible buttons would mostly be disabled. The dropdown is
 * built from `DELIVERY_TRANSITIONS` — the same table the API enforces.
 *
 * `CANCELLED` is the move with teeth worth explaining: the parcel goes back
 * to `AT_HUB` at its last hub, ready to be dispatched again, rather than
 * vanishing from the worklist.
 */
export function DeliveryStatusSheet({
  open,
  onOpenChange,
  delivery,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  delivery: DeliveryRow | null
}) {
  const queryClient = useQueryClient()

  const nextStatuses: readonly DeliveryRow["status"][] = delivery
    ? DELIVERY_TRANSITIONS[delivery.status]
    : []

  const mutation = useMutation({
    mutationFn: (body: UpdateDeliveryStatusBody) => updateDeliveryStatus(delivery!.id, body),
    onSuccess: () => {
      AppToast.success("Delivery updated")
      void queryClient.invalidateQueries({ queryKey: ["deliveries"] })
      onOpenChange(false)
    },
  })

  const firstStatus = nextStatuses[0]
  if (!delivery || !firstStatus) return null

  const needsReason = delivery ? NEEDS_REASON.has(firstStatus) : false

  const defaults: z.infer<typeof updateDeliveryStatusSchema> = { status: firstStatus, reason: "" }

  return (
    <FormSheet
      schema={updateDeliveryStatusSchema}
      open={open}
      onOpenChange={onOpenChange}
      title="Update delivery"
      description={`Currently ${DELIVERY_STATUS_LABEL[delivery.status].toLowerCase()}.`}
      submitLabel="Save status"
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{ status: "New status", reason: "Reason" }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof updateDeliveryStatusSchema>
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
                        {DELIVERY_STATUS_LABEL[status]}
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
