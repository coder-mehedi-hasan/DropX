import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { AppToast, BoundFormField, FormItem, FormLabel, FormMessage, Input } from "@dropx/ui"

import { FormSheet } from "@/components/form-sheet"
import { ReferenceCombobox } from "@/components/reference-combobox"
import { assignPickup } from "@/lib/endpoints"
import { localDateTimeToIso } from "@/lib/format"
import { assignPickupSchema, type AssignPickupBody, type Pickup } from "@/lib/types"

const BLANK: z.infer<typeof assignPickupSchema> = {
  riderId: "",
  scheduledAt: "",
}

/**
 * Send a rider to collect a parcel.
 *
 * Only the rider and the time are asked for. The address is on the pickup and is
 * shown in the sheet description rather than as an editable field: dispatch
 * occasionally corrects an address, and letting this form write it would mean a
 * second write path for the same row with a different permission behind it. A
 * wrong address is fixed by cancelling the pickup and raising a new one.
 *
 * An assigned pickup can be safely reassigned while it has not started. Once it
 * is `IN_PROGRESS`, the API refuses the write so dispatch cannot silently move a
 * rider who is already on the collection.
 */
export function PickupAssignSheet({
  open,
  onOpenChange,
  pickup,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pickup: Pickup | null
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: AssignPickupBody) => assignPickup(pickup!.id, body),
    onSuccess: () => {
      AppToast.success("Rider assigned")
      void queryClient.invalidateQueries({ queryKey: ["pickups"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={assignPickupSchema}
      open={open}
      onOpenChange={onOpenChange}
      title={pickup?.status === "ASSIGNED" ? "Reassign rider" : "Assign a rider"}
      description={pickup ? `Collect from: ${pickup.pickupAddress}` : undefined}
      submitLabel={pickup?.status === "ASSIGNED" ? "Reassign rider" : "Assign rider"}
      busy={mutation.isPending}
      defaults={BLANK}
      fieldLabels={{ riderId: "Rider", scheduledAt: "Scheduled for" }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof assignPickupSchema>
        await mutation.mutateAsync({
          riderId: typed.riderId,
          scheduledAt: localDateTimeToIso(typed.scheduledAt),
        })
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="riderId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rider</FormLabel>
                <ReferenceCombobox
                  source="riders"
                  placeholder="Select rider"
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="scheduledAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Scheduled for (optional)</FormLabel>
                <Input type="datetime-local" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    />
  )
}
