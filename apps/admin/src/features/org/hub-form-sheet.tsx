import { z } from "zod"
import {
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
import { OrgFormShell } from "./org-form-shell"
import { createHubSchema, type CreateHubBody, type Hub } from "@/lib/types"

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
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: CreateHubBody) => Promise<Hub>
}) {
  async function handleSubmit(values: z.infer<typeof schema>) {
    return onSubmit({
      ...values,
      address: values.address?.trim() || null,
      district: values.district?.trim() || null,
      latitude: values.latitude ?? null,
      longitude: values.longitude ?? null,
      capacity: values.capacity ?? null,
    } as CreateHubBody)
  }

  return (
    <OrgFormShell
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title="New hub"
      description="A hub belongs to exactly one branch. Its code is unique company-wide."
      submitLabel="Create hub"
      busy={false}
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
      onSubmit={handleSubmit as (values: Record<string, unknown>) => Promise<unknown>}
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
