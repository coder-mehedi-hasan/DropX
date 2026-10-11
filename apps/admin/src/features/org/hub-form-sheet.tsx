import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  AppToast,
  BoundFormField,
  Checkbox,
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
  Textarea,
} from "@dropx/ui"
import { HUB_SERVICES, type HubService } from "@dropx/types"
import { ReferenceCombobox } from "@/components/reference-combobox"
import { FormSheet } from "@/components/form-sheet"
import { createHub, updateHub } from "@/lib/endpoints"
import { createHubSchema, type CreateHubBody, type Hub, type UpdateHubBody } from "@/lib/types"

/** Same reasoning as the branch form: the schema is the API's DTO, so the two
 *  cannot drift — a field added here is a field the endpoint rejects. */
const schema = createHubSchema

const DEFAULT_VALUES: z.infer<typeof schema> = {
  branchId: "",
  name: "",
  code: "",
  services: [...HUB_SERVICES],
  address: "",
  district: "",
  latitude: undefined,
  longitude: undefined,
  capacity: undefined,
  status: "ACTIVE",
}

export function HubFormSheet({
  open,
  onOpenChange,
  hub,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  hub?: Hub | null
}) {
  const queryClient = useQueryClient()

  const defaults: z.infer<typeof schema> = hub
    ? {
        branchId: hub.branchId,
        name: hub.name,
        code: hub.code,
        services: hub.services,
        address: hub.address ?? "",
        district: hub.district ?? "",
        latitude: hub.latitude ?? undefined,
        longitude: hub.longitude ?? undefined,
        capacity: hub.capacity ?? undefined,
        status: hub.status,
      }
    : DEFAULT_VALUES

  const mutation = useMutation({
    mutationFn: (body: CreateHubBody | UpdateHubBody) =>
      hub ? updateHub(hub.id, body) : createHub(body as CreateHubBody),
    onSuccess: (saved) => {
      AppToast.success(hub ? `${saved.name} updated` : `${saved.name} created`)
      void queryClient.invalidateQueries({ queryKey: ["hubs"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title={hub ? "Configure hub" : "New hub"}
      description="A hub is one physical facility. Select every pickup, sorting and delivery service it provides."
      submitLabel={hub ? "Save changes" : "Create hub"}
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        branchId: "Branch",
        name: "Name",
        code: "Code",
        services: "Services",
        address: "Address",
        district: "District",
        latitude: "Latitude",
        longitude: "Longitude",
        capacity: "Capacity",
        status: "Status",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof schema>
        // `mutateAsync`, awaited — not `mutate`. The shell owns the error banner and
        // only learns there is an error because this handler rejects: it wraps the
        // call in `try/catch` and hands the rejection to `useServerErrors`. `mutate`
        // returns before the request settles and never rejects, so a 409 for a
        // duplicate hub code would be discarded silently.
        await mutation.mutateAsync({
          ...typed,
          // An emptied text input means "not supplied", which the columns store as
          // NULL rather than as an empty string.
          address: typed.address?.trim() || null,
          district: typed.district?.trim() || null,
          latitude: typed.latitude ?? null,
          longitude: typed.longitude ?? null,
          capacity: typed.capacity ?? null,
        } as CreateHubBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="branchId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch</FormLabel>
                <ReferenceCombobox
                  source="branches"
                  placeholder="Search branches"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={Boolean(hub)}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input placeholder="Dhaka Sorting" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormInputSlug name="code" inheritFrom="name" label="Code" placeholder="DHAKA-SORT" />
          <BoundFormField
            name="services"
            render={({ field }) => {
              const selected = Array.isArray(field.value) ? (field.value as HubService[]) : []
              return (
                <FormItem>
                  <FormLabel>Hub services</FormLabel>
                  <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
                    {HUB_SERVICES.map((service) => (
                      <label
                        key={service}
                        className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                      >
                        <Checkbox
                          checked={selected.includes(service)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked === true
                                ? [...selected, service]
                                : selected.filter((value) => value !== service),
                            )
                          }
                          onBlur={field.onBlur}
                        />
                        <span className="capitalize">{service.toLowerCase()}</span>
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <BoundFormField
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <Textarea rows={2} {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <BoundFormField
              name="district"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>District</FormLabel>
                  <Input placeholder="Dhaka" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <BoundFormField
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <Input type="number" min="0" placeholder="Optional" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BoundFormField
              name="latitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitude</FormLabel>
                  <Input type="number" step="any" placeholder="23.8103" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <BoundFormField
              name="longitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitude</FormLabel>
                  <Input type="number" step="any" placeholder="90.4125" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
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
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
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
