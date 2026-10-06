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
import { ReferenceCombobox } from "@/components/reference-combobox"
import { createDelivery, reassignDelivery } from "@/lib/endpoints"
import type { DeliveryRow } from "@/lib/types"
import { createDeliverySchema, reassignDeliverySchema } from "@/lib/types"

/**
 * Open an attempt for a parcel, or swap the rider on one that has not started.
 *
 * Two modes on one component: `delivery === null` creates (parcel id or
 * tracking number typed by hand — the same convention as a pickup), otherwise
 * it reassigns the rider. They are separate operations with different
 * permissions' neighbours (`deliveries.assign` for both) and different
 * bodies, and both are about "who carries this parcel" so they belong
 * together. The schema switches with the mode; the parent remounts the sheet
 * via `key`, so the defaults never leak between modes.
 */
export function DeliveryAssignSheet({
  open,
  onOpenChange,
  delivery,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  delivery: DeliveryRow | null
}) {
  const queryClient = useQueryClient()
  const isReassign = delivery !== null

  const createMutation = useMutation({
    mutationFn: (body: z.infer<typeof createDeliverySchema>) => createDelivery(body),
    onSuccess: () => {
      AppToast.success("Delivery assigned")
      void queryClient.invalidateQueries({ queryKey: ["deliveries"] })
      onOpenChange(false)
    },
  })

  const reassignMutation = useMutation({
    mutationFn: (body: z.infer<typeof reassignDeliverySchema>) =>
      reassignDelivery(delivery!.id, body),
    onSuccess: () => {
      AppToast.success("Rider reassigned")
      void queryClient.invalidateQueries({ queryKey: ["deliveries"] })
      onOpenChange(false)
    },
  })

  const busy = createMutation.isPending || reassignMutation.isPending

  if (isReassign) {
    return (
      <FormSheet
        schema={reassignDeliverySchema}
        open={open}
        onOpenChange={onOpenChange}
        title="Reassign rider"
        description={`Attempt ${delivery.attemptNo} on ${delivery.parcelTrackingNumber} — ${delivery.deliveryAddress}`}
        submitLabel="Reassign rider"
        busy={busy}
        defaults={{ riderId: "" }}
        fieldLabels={{ riderId: "Rider" }}
        onSubmit={async (values) => {
          const typed = values as z.infer<typeof reassignDeliverySchema>
          await reassignMutation.mutateAsync({ riderId: typed.riderId })
        }}
        error={null}
        renderFields={() => (
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
        )}
      />
    )
  }

  return (
    <FormSheet
      schema={createDeliverySchema}
      open={open}
      onOpenChange={onOpenChange}
      title="New delivery"
      description="Opens an attempt for a parcel. One open attempt per parcel."
      submitLabel="Create delivery"
      busy={busy}
      defaults={{ parcelId: "", riderId: "", deliveryAddress: "" }}
      fieldLabels={{ parcelId: "Parcel", riderId: "Rider", deliveryAddress: "Delivery address" }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof createDeliverySchema>
        await createMutation.mutateAsync({
          parcelId: typed.parcelId,
          riderId: typed.riderId,
          deliveryAddress: typed.deliveryAddress,
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
            name="deliveryAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery address</FormLabel>
                <Textarea
                  rows={2}
                  placeholder="House, road, area — where the rider should deliver"
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
