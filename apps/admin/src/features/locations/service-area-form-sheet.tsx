import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  AppToast,
  BoundFormField,
  FormInputSlug,
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
import { RECORD_STATUSES } from "@dropx/types"
import { FormSheet } from "@/components/form-sheet"
import { createServiceArea, updateServiceArea } from "@/lib/endpoints"
import {
  createServiceAreaSchema,
  type CreateServiceAreaBody,
  type ServiceArea,
  type UpdateServiceAreaBody,
} from "@/lib/types"
import { useCityOptions, useServiceZoneOptions } from "./location-options"

const schema = createServiceAreaSchema

const BLANK: z.infer<typeof schema> = {
  zoneId: "",
  name: "",
  code: "",
  status: "ACTIVE",
}

export function ServiceAreaFormSheet({
  open,
  onOpenChange,
  area,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  area?: ServiceArea | null
}) {
  const queryClient = useQueryClient()
  const cityOptions = useCityOptions()
  const zoneOptions = useServiceZoneOptions()

  const cityById = new Map(cityOptions.data?.nodes.map((city) => [city.id, city.name]))
  const zoneLabel = (zoneId: string) => {
    const zone = zoneOptions.data?.nodes.find((candidate) => candidate.id === zoneId)
    if (!zone) return ""
    const city = cityById.get(zone.cityId)
    return city ? `${city} — ${zone.name}` : zone.name
  }

  const defaults: z.infer<typeof schema> = area
    ? {
        zoneId: area.zoneId,
        name: area.name,
        code: area.code,
        status: area.status,
      }
    : BLANK

  const mutation = useMutation({
    mutationFn: (body: CreateServiceAreaBody | UpdateServiceAreaBody) =>
      area ? updateServiceArea(area.id, body) : createServiceArea(body as CreateServiceAreaBody),
    onSuccess: (saved) => {
      AppToast.success(area ? `${saved.name} updated` : `${saved.name} created`)
      void queryClient.invalidateQueries({ queryKey: ["location"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title={area ? "Edit area" : "New area"}
      description="A neighbourhood inside a zone. Addresses land here."
      submitLabel={area ? "Save area" : "Create area"}
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        zoneId: "Zone",
        name: "Name",
        code: "Code",
        status: "Status",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof schema>
        await mutation.mutateAsync(typed as CreateServiceAreaBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="zoneId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zone</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zoneOptions.data?.nodes.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zoneLabel(zone.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input placeholder="Badamtola" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormInputSlug name="code" inheritFrom="name" label="Code" placeholder="DHK-BDM" />
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
                    {RECORD_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "ACTIVE" ? "Active" : "Inactive"}
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
