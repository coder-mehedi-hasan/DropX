"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LoadingButton,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Textarea,
  useConfirmation,
} from "@dropx/ui"
import { MapPinIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react"
import * as React from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { PageHeader } from "@/components/page-header"
import { ReferenceSelect } from "@/components/reference-select"
import { isApiError } from "@/lib/api-client"
import {
  useCities,
  useCityZones,
  useCreateAddress,
  useDeleteAddress,
  useSavedAddresses,
  useUpdateAddress,
  useZoneAreas,
} from "@/lib/queries"
import type { CreateCustomerAddressInput, CustomerAddress } from "@/lib/types"

/**
 * The customer's saved-address book.
 *
 * A saved address is structured like one end of a booking — the same city/zone/
 * area cascade plus an address line — so it can prefill the booking form. The
 * screen is a list of cards plus a sheet for the create/edit form, because the
 * cascade needs the room a side panel gives and a booking already knows how to
 * read the result.
 */

const addressFormSchema = z.object({
  label: z.string().trim().max(50).nullish(),
  cityId: z.string().trim().min(1, "Pick the city"),
  zoneId: z.string().trim().min(1, "Pick the zone"),
  areaId: z.string(),
  addressLine: z.string().trim().min(1, "Enter the house, building or flat details").max(300),
  landmark: z.string().trim().max(200).nullish(),
  isDefault: z.boolean(),
})

type AddressFormValues = z.infer<typeof addressFormSchema>

function blankForm(): AddressFormValues {
  return {
    label: null,
    cityId: "",
    zoneId: "",
    areaId: "",
    addressLine: "",
    landmark: null,
    isDefault: false,
  }
}

function addressToForm(address: CustomerAddress): AddressFormValues {
  return {
    label: address.label,
    cityId: address.cityId,
    zoneId: address.zoneId,
    areaId: address.areaId ?? "",
    addressLine: address.addressLine,
    landmark: address.landmark,
    isDefault: address.isDefault,
  }
}

function formToPayload(values: AddressFormValues): CreateCustomerAddressInput {
  return {
    label: values.label || null,
    cityId: values.cityId,
    zoneId: values.zoneId,
    ...(values.areaId ? { areaId: values.areaId } : {}),
    addressLine: values.addressLine,
    landmark: values.landmark || null,
    isDefault: values.isDefault,
  }
}

export function SavedAddresses() {
  const addresses = useSavedAddresses()
  const cities = useCities()
  const deleteAddress = useDeleteAddress()
  const { confirm, confirmationDialog } = useConfirmation()

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CustomerAddress | null>(null)

  const cityOptions = cities.data ?? []

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(address: CustomerAddress) {
    setEditing(address)
    setSheetOpen(true)
  }

  async function onDelete(address: CustomerAddress) {
    const ok = await confirm({
      title: "Delete this saved address?",
      description: `"${address.label || address.addressLine}" will be removed from your address book.`,
      confirmLabel: "Delete address",
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteAddress.mutateAsync(address.id)
      toast.success("Address deleted")
    } catch {
      toast.error("Could not delete that address. Please try again.")
    }
  }

  return (
    <div className="grid w-full gap-7">
      {confirmationDialog}
      <PageHeader
        eyebrow="Account"
        title="Saved addresses"
        description="Reuse the places you send and receive from. Pick one while booking to fill the address in one tap."
        actions={
          <Button onClick={openNew}>
            <PlusIcon />
            Add address
          </Button>
        }
      />

      {addresses.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : null}

      {addresses.isError ? (
        <EmptyState
          icon={MapPinIcon}
          title="Could not load your addresses"
          description="The saved-address list did not load. Pull to refresh and try again."
        />
      ) : null}

      {addresses.isSuccess && addresses.data.length === 0 ? (
        <EmptyState
          icon={MapPinIcon}
          title="No saved addresses yet"
          description="Save the places you send and receive from to skip typing them every time."
          action={
            <Button onClick={openNew}>
              <PlusIcon />
              Add your first address
            </Button>
          }
        />
      ) : null}

      {addresses.isSuccess && addresses.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.data.map((address) => (
            <Card key={address.id} className="gap-0 overflow-hidden py-0">
              <CardContent className="grid gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                      <MapPinIcon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{address.label || "Saved address"}</p>
                      {address.isDefault ? (
                        <p className="text-primary flex items-center gap-1 text-xs font-medium">
                          <StarIcon className="size-3" aria-hidden />
                          Default
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${address.label || "address"}`}
                      onClick={() => openEdit(address)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${address.label || "address"}`}
                      onClick={() => onDelete(address)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>

                <div className="text-muted-foreground grid gap-1 text-sm">
                  <p className="break-words">{address.addressLine}</p>
                  <p className="break-words">
                    {[address.areaName, address.zoneName, address.cityName]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {address.landmark ? (
                    <p className="break-words">Landmark — {address.landmark}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <AddressFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        cityOptions={cityOptions}
      />
    </div>
  )
}

function AddressFormSheet({
  open,
  onOpenChange,
  editing,
  cityOptions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: CustomerAddress | null
  cityOptions: { id: string; label: string; description?: string }[]
}) {
  const createAddress = useCreateAddress()
  const updateAddress = useUpdateAddress()
  const busy = createAddress.isPending || updateAddress.isPending

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    mode: "onBlur",
    defaultValues: blankForm(),
  })

  // Reset to the record's values on open — the shell remounts via `key`, so the
  // defaults never leak between create and edit.
  React.useEffect(() => {
    if (open) form.reset(editing ? addressToForm(editing) : blankForm())
  }, [open, editing, form])

  const pickedCityId = form.watch("cityId")
  const pickedZoneId = form.watch("zoneId")
  const zones = useCityZones(pickedCityId)
  const areas = useZoneAreas(pickedZoneId)

  const zoneOptions = zones.data ?? []
  const areaOptions = areas.data ?? []

  function selectCity(cityId: string) {
    form.setValue("cityId", cityId, { shouldValidate: false })
    form.setValue("zoneId", "", { shouldValidate: false })
    form.setValue("areaId", "")
  }

  function selectZone(zoneId: string) {
    form.setValue("zoneId", zoneId, { shouldValidate: false })
    form.setValue("areaId", "")
  }

  async function onSubmit(values: AddressFormValues) {
    const payload = formToPayload(values)
    try {
      if (editing) {
        await updateAddress.mutateAsync({ id: editing.id, payload })
        toast.success("Address updated")
      } else {
        await createAddress.mutateAsync(payload)
        toast.success("Address saved")
      }
      onOpenChange(false)
    } catch (error) {
      if (isApiError(error)) {
        const fieldErrors = error.fieldErrors
        const fields = Object.keys(fieldErrors) as Array<keyof AddressFormValues>
        for (const field of fields) {
          form.setError(field, { message: fieldErrors[field] })
        }
        if (fields.length === 0) toast.error(error.message)
      } else {
        toast.error("Could not save that address. Please try again.")
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit address" : "Save an address"}</SheetTitle>
          <SheetDescription>
            The same city, zone and area picks a booking uses — choose one here and it is ready to
            reuse.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            className="grid gap-5 px-4 pt-2 pb-6"
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Home, Office, Mum's place"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value || null)}
                    />
                  </FormControl>
                  <FormDescription>Optional — so you can tell them apart.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="cityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <ReferenceSelect
                      value={field.value}
                      onValueChange={selectCity}
                      options={cityOptions}
                      source="cities"
                      placeholder="Pick the city"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zoneId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zone</FormLabel>
                    <ReferenceSelect
                      value={field.value}
                      onValueChange={selectZone}
                      options={zoneOptions}
                      source="city-zones"
                      loading={!pickedCityId}
                      placeholder="Pick the zone"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="areaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Area <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <ReferenceSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    options={areaOptions}
                    source="zone-areas"
                    loading={!pickedZoneId}
                    placeholder="Pick an area, if listed"
                    emptyTitle="No areas in this zone yet"
                  />
                  <FormDescription>Optional — narrows the drop-off for the rider.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressLine"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address line</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="House / Building / Flat number, road and landmark"
                      autoComplete="street-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="landmark"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Landmark</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Near the big mosque, blue gate"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value || null)}
                    />
                  </FormControl>
                  <FormDescription>Optional — helps the rider find the door.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-4 rounded-xl border px-4 py-3">
                  <div className="grid gap-0.5">
                    <FormLabel className="text-sm font-medium">Set as default</FormLabel>
                    <FormDescription>Suggested first when you book.</FormDescription>
                  </div>
                  <FormControl>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.value}
                      aria-label="Set as default"
                      onClick={() => field.onChange(!field.value)}
                      className={cnToggle(field.value)}
                    >
                      <span className={cnToggleThumb(field.value)} />
                    </button>
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid gap-2 pt-2">
              <LoadingButton type="submit" className="w-full" loading={busy}>
                {editing ? "Save changes" : "Save address"}
              </LoadingButton>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

function cnToggle(checked: boolean) {
  return [
    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
    checked ? "bg-primary" : "bg-input",
  ].join(" ")
}

function cnToggleThumb(checked: boolean) {
  return [
    "inline-block size-4 transform rounded-full bg-white transition-transform",
    checked ? "translate-x-6" : "translate-x-1",
  ].join(" ")
}
