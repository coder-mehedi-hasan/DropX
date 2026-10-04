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
import { FormSheet } from "@/components/form-sheet"
import { createBranchSchema, type CreateBranchBody, type Branch } from "@/lib/types"

/** The create form's schema. It is the same shape the API validates, so a
 *  field added here is a field the endpoint rejects — the two cannot drift. */
const schema = createBranchSchema

const DEFAULT_VALUES: z.infer<typeof schema> = {
  name: "",
  code: "",
  phone: "",
  address: "",
  city: "",
  district: "",
  latitude: undefined,
  longitude: undefined,
  status: "ACTIVE",
}

export function BranchFormSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: CreateBranchBody) => Promise<Branch>
}) {
  async function handleSubmit(values: z.infer<typeof schema>) {
    return onSubmit({
      ...values,
      phone: values.phone?.trim() || null,
      address: values.address?.trim() || null,
      city: values.city?.trim() || null,
      district: values.district?.trim() || null,
    } as CreateBranchBody)
  }

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title="New branch"
      description="A regional office. Code is the company-wide slug used in URLs."
      submitLabel="Create branch"
      busy={false}
      defaults={DEFAULT_VALUES}
      fieldLabels={{
        name: "Name",
        code: "Code",
        phone: "Phone",
        address: "Address",
        city: "City",
        district: "District",
        latitude: "Latitude",
        longitude: "Longitude",
        status: "Status",
      }}
      onSubmit={handleSubmit as (values: Record<string, unknown>) => Promise<unknown>}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input placeholder="Dhaka North" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <Input placeholder="DHAKA-NORTH" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <Input placeholder="+8801700000000" {...field} />
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
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <Input placeholder="Dhaka" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
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
