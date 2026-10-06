import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  AppToast,
  BoundFormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dropx/ui"
import { VEHICLE_STATUSES, VEHICLE_TYPES } from "@dropx/types"
import { FormSheet } from "@/components/form-sheet"
import { createVehicle, updateVehicle } from "@/lib/endpoints"
import { VEHICLE_STATUS_LABELS, VEHICLE_TYPE_LABELS } from "./labels"
import {
  createVehicleSchema,
  type CreateVehicleBody,
  type UpdateVehicleBody,
  type Vehicle,
} from "@/lib/types"

/** The form's schema. It is the same shape the API validates, so a field added
 *  here is a field the endpoint rejects — the two cannot drift. */
const schema = createVehicleSchema

const BLANK: z.infer<typeof schema> = {
  registrationNumber: "",
  type: "VAN",
  capacityKg: 500,
  status: "AVAILABLE",
}

/**
 * One sheet for both directions. `vehicle` absent means create; present means
 * edit, and the shell resets to the record's values on open — which is why the
 * defaults are derived per render instead of being a module constant.
 */
export function VehicleFormSheet({
  open,
  onOpenChange,
  vehicle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle | null
}) {
  const queryClient = useQueryClient()

  const defaults: z.infer<typeof schema> = vehicle
    ? {
        registrationNumber: vehicle.registrationNumber,
        type: vehicle.type,
        capacityKg: vehicle.capacityKg,
        status: vehicle.status,
      }
    : BLANK

  const mutation = useMutation({
    mutationFn: (body: CreateVehicleBody | UpdateVehicleBody) =>
      vehicle ? updateVehicle(vehicle.id, body) : createVehicle(body as CreateVehicleBody),
    onSuccess: (saved) => {
      AppToast.success(
        vehicle
          ? `${saved.registrationNumber} updated`
          : `${saved.registrationNumber} added to the fleet`,
      )
      void queryClient.invalidateQueries({ queryKey: ["vehicles"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title={vehicle ? "Edit vehicle" : "New vehicle"}
      description="Register a vehicle for hub-to-hub transfers."
      submitLabel={vehicle ? "Save vehicle" : "Create vehicle"}
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        registrationNumber: "Registration number",
        type: "Type",
        capacityKg: "Capacity (kg)",
        status: "Status",
      }}
      onSubmit={async (values) => {
        // Awaited `mutateAsync`, not `mutate` — see the zone sheet. The shell only
        // learns a save failed because this handler rejects.
        await mutation.mutateAsync(values as CreateVehicleBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="registrationNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Registration number</FormLabel>
                <Input placeholder="DHK-1234" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {VEHICLE_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="capacityKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity (kg)</FormLabel>
                <Input type="number" step="any" min={0} {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {VEHICLE_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    />
  )
}
