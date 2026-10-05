import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  AppToast,
  BoundFormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from "@dropx/ui"

import { FormSheet } from "@/components/form-sheet"
import { createPickup } from "@/lib/endpoints"
import { localDateTimeToIso } from "@/lib/format"
import { createPickupSchema, type CreatePickupBody } from "@/lib/types"

const BLANK: z.infer<typeof createPickupSchema> = {
  parcelId: "",
  pickupAddress: "",
  scheduledAt: "",
}

/**
 * Raise a collection.
 *
 * `parcelId` is a plain text field rather than a parcel picker, which is a
 * deliberate exception to the reference-picker rule used everywhere else in this
 * app. A pickup is created while someone is on the phone with a customer, who
 * reads out a tracking number — a dropdown over every parcel would make them
 * search a list instead of typing the one string they were given. The API accepts
 * either an id or a tracking number for exactly this reason, so the label says so.
 *
 * There is no status field. A new pickup is always `REQUESTED`, and the API's
 * create body defaults it; offering the other five would mean creating a pickup
 * in a state no one can reach by the normal route.
 */
export function PickupFormSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: CreatePickupBody) => createPickup(body),
    onSuccess: () => {
      AppToast.success("Pickup raised")
      void queryClient.invalidateQueries({ queryKey: ["pickups"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={createPickupSchema}
      open={open}
      onOpenChange={onOpenChange}
      title="New pickup"
      description="Raises a collection for a parcel. A parcel can have one unfinished pickup at a time."
      submitLabel="Create pickup"
      busy={mutation.isPending}
      defaults={BLANK}
      fieldLabels={{
        parcelId: "Parcel",
        pickupAddress: "Collection address",
        scheduledAt: "Scheduled for",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof createPickupSchema>
        await mutation.mutateAsync({
          parcelId: typed.parcelId,
          pickupAddress: typed.pickupAddress,
          scheduledAt: localDateTimeToIso(typed.scheduledAt),
        })
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="parcelId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parcel</FormLabel>
                <Input placeholder="DX-2026-000123 or the parcel id" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="pickupAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Collection address</FormLabel>
                <Textarea
                  rows={2}
                  placeholder="House, road, area — where the rider should turn up"
                  {...field}
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
