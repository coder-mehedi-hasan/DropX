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
import { TRANSFER_TRANSITIONS } from "@dropx/types"

import { FormSheet } from "@/components/form-sheet"
import { updateTransferStatus } from "@/lib/endpoints"
import type { TransferWithManifest, UpdateTransferStatusBody } from "@/lib/types"
import { updateTransferStatusSchema } from "@/lib/types"
import { TRANSFER_STATUS_LABEL } from "./transfer-status"

/**
 * Move a transfer along its lifecycle.
 *
 * One sheet for every move rather than a row of buttons, because the legal moves
 * differ per status and a row that showed the same three buttons everywhere would
 * have to disable most of them at any time. Here the dropdown is built from
 * `TRANSFER_TRANSITIONS` — the same table the API enforces — so an impossible move
 * is never offered, and the reason field only appears for the status that needs
 * one.
 *
 * `IN_TRANSIT` is the move with teeth: it also moves every manifest parcel, and
 * the customer sees that immediately. `ARRIVED` does the same in reverse. The
 * description says so on the option rather than after the fact.
 */
export function TransferStatusSheet({
  open,
  onOpenChange,
  transfer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  transfer: TransferWithManifest | null
}) {
  const queryClient = useQueryClient()

  const nextStatuses: readonly TransferWithManifest["status"][] = transfer
    ? TRANSFER_TRANSITIONS[transfer.status]
    : []
  const firstStatus = nextStatuses[0]

  const mutation = useMutation({
    mutationFn: (body: UpdateTransferStatusBody) => updateTransferStatus(transfer!.id, body),
    onSuccess: () => {
      AppToast.success("Transfer updated")
      void queryClient.invalidateQueries({ queryKey: ["transfers"] })
      onOpenChange(false)
    },
  })

  if (!transfer || !firstStatus) return null

  const defaults: z.infer<typeof updateTransferStatusSchema> = { status: firstStatus, reason: "" }

  return (
    <FormSheet
      schema={updateTransferStatusSchema}
      open={open}
      onOpenChange={onOpenChange}
      title="Update transfer"
      description={`Currently ${TRANSFER_STATUS_LABEL[transfer.status].toLowerCase()}.`}
      submitLabel="Save status"
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{ status: "New status", reason: "Reason" }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof updateTransferStatusSchema>
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
                        {TRANSFER_STATUS_LABEL[status]}
                        {status === "IN_TRANSIT" ? " — moves every parcel" : ""}
                        {status === "ARRIVED" ? " — moves every parcel" : ""}
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
                <FormLabel>Reason (required for cancellation)</FormLabel>
                <Textarea
                  rows={2}
                  placeholder="Truck broke down, route closed, consignee refused…"
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
