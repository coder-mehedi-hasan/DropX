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
  Textarea,
} from "@dropx/ui"
import { FormSheet } from "@/components/form-sheet"
import { createBranch } from "@/lib/endpoints"
import { createBranchSchema, type CreateBranchBody } from "@/lib/types"

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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: CreateBranchBody) => createBranch(body),
    onSuccess: (saved) => {
      AppToast.success(`${saved.name} created`)
      void queryClient.invalidateQueries({ queryKey: ["branches"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title="New branch"
      description="A regional office. Code is the company-wide slug used in URLs."
      submitLabel="Create branch"
      busy={mutation.isPending}
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
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof schema>
        // `mutateAsync`, awaited — not `mutate`. The shell owns the error banner and
        // only learns there is an error because this handler rejects: it wraps the
        // call in `try/catch` and hands the rejection to `useServerErrors`. `mutate`
        // returns before the request settles and never rejects, so a 409 for a
        // duplicate branch code would be discarded silently.
        await mutation.mutateAsync({
          ...typed,
          // An emptied text input means "not supplied", which the columns store as
          // NULL rather than as an empty string.
          phone: typed.phone?.trim() || null,
          address: typed.address?.trim() || null,
          city: typed.city?.trim() || null,
          district: typed.district?.trim() || null,
        } as CreateBranchBody)
      }}
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
          <FormInputSlug
            name="code"
            inheritFrom="name"
            label="Code"
            placeholder="DHAKA-NORTH"
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
