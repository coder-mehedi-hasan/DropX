import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useFormContext } from "react-hook-form"
import { z } from "zod"
import * as React from "react"
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
import { createPickup, getParcel } from "@/lib/endpoints"
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
 * The parcel picker searches the staff parcel list by tracking number or parcel
 * id, then submits the selected parcel id. The API still accepts either form
 * for callers that do not use the picker.
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
      renderFields={() => <PickupFields />}
    />
  )
}

function PickupFields() {
  const form = useFormContext<z.infer<typeof createPickupSchema>>()
  const parcelId = form.watch("parcelId")
  const parcel = useQuery({
    queryKey: ["parcels", "detail", parcelId],
    queryFn: ({ signal }) => getParcel(parcelId, signal),
    enabled: Boolean(parcelId),
    staleTime: 60_000,
  })
  const hydratedParcelId = React.useRef("")

  React.useEffect(() => {
    if (!parcel.data || hydratedParcelId.current === parcelId) return

    const pickupAddress = parcel.data.addresses.find((address) => address.type === "PICKUP")
    if (pickupAddress) {
      form.setValue("pickupAddress", formatPickupAddress(pickupAddress), {
        shouldDirty: false,
        shouldValidate: true,
      })
    }
    hydratedParcelId.current = parcelId
  }, [form, parcel.data, parcelId])

  React.useEffect(() => {
    if (!parcelId) hydratedParcelId.current = ""
  }, [parcelId])

  return (
    <>
      <BoundFormField
        name="parcelId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Parcel</FormLabel>
            <ReferenceCombobox
              source="parcels"
              placeholder="Search parcel ID or tracking number"
              value={field.value}
              onChange={(value) => {
                hydratedParcelId.current = ""
                form.setValue("pickupAddress", "", { shouldDirty: true })
                field.onChange(value)
              }}
            />
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
  )
}

function formatPickupAddress(address: {
  addressLine: string
  landmark: string | null
  areaName: string | null
  zoneName: string
  cityName: string
}) {
  return [address.addressLine, address.landmark, address.areaName, address.zoneName, address.cityName]
    .filter((part): part is string => Boolean(part))
    .join(", ")
}
