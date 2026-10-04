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
  Textarea,
} from "@dropx/ui"
import { ReferenceCombobox } from "@/components/reference-combobox"
import { FormSheet } from "@/components/form-sheet"
import { createHub } from "@/lib/endpoints"
import { createHubSchema, type CreateHubBody } from "@/lib/types"

/** Same reasoning as the branch form: the schema is the API's DTO, so the two
 *  cannot drift — a field added here is a field the endpoint rejects. */
const schema = createHubSchema

const DEFAULT_VALUES: z.infer<typeof schema> = {
  branchId: "",
  name: "",
  code: "",
  type: "ORIGIN",
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: CreateHubBody) => createHub(body),
    onSuccess: (saved) => {
      AppToast.success(`${saved.name} created`)
      void queryClient.invalidateQueries({ queryKey: ["hubs"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title="New hub"
      description="A hub belongs to exactly one branch. Its code is unique company-wide."
      submitLabel="Create hub"
      busy={mutation.isPending}
      defaults={DEFAULT_VALUES}
      fieldLabels={{
        branchId: "Branch",
        name: "Name",
        code: "Code",
        type: "Type",
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
          <BoundFormField
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <Input placeholder="DHAKA-SORT" {...field} />
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
                    <SelectItem value="ORIGIN">Origin</SelectItem>
                    <SelectItem value="SORTING">Sorting</SelectItem>
                    <SelectItem value="TRANSIT">Transit</SelectItem>
                    <SelectItem value="DESTINATION">Destination</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
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
