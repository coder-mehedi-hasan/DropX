import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
  LoadingButton,
} from "@dropx/ui"
import { toast } from "sonner"

import { ServerError } from "@/components/server-error"
import { createParcel, quoteDeliveryFee } from "@/lib/endpoints"
import { formatMoney } from "@/lib/format"
import { PARCEL_TYPES, PAYMENT_TYPES, type CreateParcelBody } from "@/lib/parcels"

import { FieldErrorSummary, mapDetailsToFields } from "./parcel-form-errors"

/**
 * Mirrors `createParcelSchema` in `apps/api`.
 *
 * Numeric inputs stay strings in form state. `z.coerce.number()` would make the
 * resolver's input type `unknown`, which in turn hands `react-hook-form` an
 * `unknown` value to spread onto `<Input>` — so the coercion happens once, in
 * `toCreateBody`, and the schema validates the string with the same bounds the
 * API enforces.
 *
 * `originHubId !== destinationHubId` is repeated here only to catch the mistake
 * before a round trip, never to replace the API's answer.
 */
const DECIMAL_PLACES = "at most 2 decimal places"

function decimalString(max: number, options: { positive?: boolean } = {}) {
  return z
    .string()
    .trim()
    .refine(
      (value) => {
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return false
        if (options.positive ? parsed <= 0 : parsed < 0) return false
        return parsed <= max && Number.isInteger(parsed * 100)
      },
      { message: `Enter a number between 0 and ${max} with ${DECIMAL_PLACES}` },
    )
}

/** `""` is the "not measured" answer, so it has to survive validation. */
function optionalDecimalString(max: number) {
  return z
    .string()
    .trim()
    .refine(
      (value) => {
        if (value === "") return true
        const parsed = Number(value)
        return (
          Number.isFinite(parsed) && parsed >= 0 && parsed <= max && Number.isInteger(parsed * 100)
        )
      },
      { message: `Enter 0, or a number between 0 and ${max} with ${DECIMAL_PLACES}` },
    )
}

function moneyString() {
  return z
    .string()
    .trim()
    .refine(
      (value) => {
        const parsed = Number(value)
        return (
          Number.isFinite(parsed) &&
          parsed >= 0 &&
          parsed <= 1_000_000 &&
          Number.isInteger(parsed * 100)
        )
      },
      { message: `Enter 0, or an amount up to 1000000 with ${DECIMAL_PLACES}` },
    )
}

function integerString(min: number, max: number) {
  return z
    .string()
    .trim()
    .refine(
      (value) => {
        const parsed = Number(value)
        return Number.isInteger(parsed) && parsed >= min && parsed <= max
      },
      { message: `Enter a whole number between ${min} and ${max}` },
    )
}

const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(200),
  description: z.string().trim().max(2000).optional(),
  quantity: integerString(1, 9999),
  unitPrice: moneyString(),
})

const createParcelSchema = z
  .object({
    senderCustomerId: z.string().trim().min(1, "Pick the customer sending the parcel"),
    receiverCustomerId: z.string().trim().min(1, "Pick the customer receiving the parcel"),
    receiverName: z.string().trim().min(1, "Receiver name is required").max(150),
    receiverPhone: z.string().trim().min(6, "Enter a valid phone number").max(30),
    originHubId: z.string().trim().min(1, "Pick an origin hub"),
    destinationHubId: z.string().trim().min(1, "Pick a destination hub"),
    originZoneId: z.string().trim().min(1, "Pick an origin zone"),
    destinationZoneId: z.string().trim().min(1, "Pick a destination zone"),
    weight: decimalString(9999, { positive: true }),
    length: optionalDecimalString(9999),
    width: optionalDecimalString(9999),
    height: optionalDecimalString(9999),
    parcelType: z.enum(PARCEL_TYPES),
    paymentType: z.enum(PAYMENT_TYPES),
    codAmount: moneyString(),
    items: z.array(itemSchema).max(50),
  })
  .refine((value) => value.originHubId !== value.destinationHubId, {
    error: "Origin and destination hub must differ",
    path: ["destinationHubId"],
  })
  .refine(
    (value) =>
      value.paymentType === "COD" || value.codAmount === "" || Number(value.codAmount) === 0,
    {
      error: "COD amount only applies to COD parcels",
      path: ["codAmount"],
    },
  )

type CreateParcelValues = z.infer<typeof createParcelSchema>

const DEFAULT_VALUES: CreateParcelValues = {
  senderCustomerId: "",
  receiverCustomerId: "",
  receiverName: "",
  receiverPhone: "",
  originHubId: "",
  destinationHubId: "",
  originZoneId: "",
  destinationZoneId: "",
  weight: "1",
  length: "",
  width: "",
  height: "",
  parcelType: "PACKAGE",
  paymentType: "PREPAID",
  codAmount: "0",
  items: [],
}

export function ParcelCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<unknown>(null)

  const form = useForm<CreateParcelValues>({
    resolver: zodResolver(createParcelSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const items = useFieldArray({ control: form.control, name: "items" })

  const watched = form.watch()
  const weight = Number(watched.weight)
  const codAmount = Number(watched.codAmount) || 0
  const canQuote =
    watched.originZoneId.length > 0 &&
    watched.destinationZoneId.length > 0 &&
    watched.originZoneId !== watched.destinationZoneId &&
    Number.isFinite(weight) &&
    weight > 0

  const quote = useQuery({
    queryKey: [
      "pricing",
      "quote",
      watched.originZoneId,
      watched.destinationZoneId,
      weight,
      codAmount,
    ],
    queryFn: ({ signal }) =>
      quoteDeliveryFee(
        {
          originZoneId: watched.originZoneId,
          destinationZoneId: watched.destinationZoneId,
          weightKg: weight,
          codAmount,
          express: false,
        },
        signal,
      ),
    enabled: open && canQuote,
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: (values: CreateParcelBody) => createParcel(values),
    onSuccess: (parcel) => {
      toast.success(`Parcel ${parcel.trackingNumber} booked`)
      onCreated()
      void queryClient.invalidateQueries({ queryKey: ["parcels"] })
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      mapDetailsToFields(error, form.setError)
      setServerError(error)
    },
  })

  function onSubmit(values: CreateParcelValues) {
    setServerError(null)
    mutation.mutate(toCreateBody(values))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return
        if (next) form.reset(DEFAULT_VALUES)
        setServerError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New parcel</DialogTitle>
          <DialogDescription>
            Staff booking on a customer's behalf. The sender and receiver must both be existing
            customers, and the delivery fee is calculated by the API.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
            <ServerError
              error={serverError}
              title="Unable to book this parcel"
              onDismiss={() => setServerError(null)}
            />
            <FieldErrorSummary errors={form.formState.errors} />

            <section className="space-y-3">
              <SectionLabel>Customers</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="senderCustomerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sender customer id</FormLabel>
                      <FormControl>
                        <Input placeholder="12" disabled={mutation.isPending} {...field} />
                      </FormControl>
                      <FormDescription>
                        Staff bookings always name a sender customer.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receiverCustomerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receiver customer id</FormLabel>
                      <FormControl>
                        <Input placeholder="34" disabled={mutation.isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receiverName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receiver name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ayesha Rahman"
                          disabled={mutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receiverPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receiver phone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+8801700000000"
                          disabled={mutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionLabel>Route</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="originHubId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origin hub id</FormLabel>
                      <FormControl>
                        <Input placeholder="1" disabled={mutation.isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="destinationHubId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination hub id</FormLabel>
                      <FormControl>
                        <Input placeholder="4" disabled={mutation.isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="originZoneId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origin zone id</FormLabel>
                      <FormControl>
                        <Input placeholder="2" disabled={mutation.isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="destinationZoneId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination zone id</FormLabel>
                      <FormControl>
                        <Input placeholder="5" disabled={mutation.isPending} {...field} />
                      </FormControl>
                      <FormDescription>Fees are anchored on the destination zone.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <SectionLabel>Contents</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-4">
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={mutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Length (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={mutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="width"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Width (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={mutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={mutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="parcelType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parcel type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={mutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PARCEL_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={mutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type === "COD" ? "Cash on delivery" : "Prepaid"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="codAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount to collect (BDT)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={mutation.isPending || watched.paymentType !== "COD"}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Only applies to cash-on-delivery parcels.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {canQuote ? (
                quote.isError ? (
                  <ServerError error={quote.error} title="Delivery fee could not be quoted" />
                ) : quote.isPending ? (
                  <p className="text-muted-foreground text-sm">Quoting the delivery fee…</p>
                ) : (
                  <Alert>
                    <Badge variant="secondary">Estimated fee</Badge>
                    <AlertTitle>{formatMoney(quote.data.total)}</AlertTitle>
                    <AlertDescription>
                      <p>
                        Base {formatMoney(quote.data.basePrice)} + weight{" "}
                        {formatMoney(quote.data.weightCharge)}
                        {quote.data.codFee > 0 ? ` + COD ${formatMoney(quote.data.codFee)}` : ""}.
                        The API recomputes this when the parcel is booked.
                      </p>
                    </AlertDescription>
                  </Alert>
                )
              ) : (
                <p className="text-muted-foreground text-sm">
                  Choose an origin and destination zone to preview the delivery fee.
                </p>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Items</SectionLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={mutation.isPending || items.fields.length >= 50}
                  onClick={() =>
                    items.append({ name: "", description: "", quantity: "1", unitPrice: "0" })
                  }
                >
                  <Plus />
                  Add item
                </Button>
              </div>

              {items.fields.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No line items. Add one when the parcel is a multi-item shipment that needs
                  declaring.
                </p>
              ) : (
                <div className="space-y-4">
                  {items.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid gap-3 rounded-lg border p-3 sm:grid-cols-12"
                    >
                      <FormField
                        control={form.control}
                        name={`items.${index}.name`}
                        render={({ field: itemField }) => (
                          <FormItem className="sm:col-span-5">
                            <FormLabel>Item</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Cotton shirt"
                                disabled={mutation.isPending}
                                {...itemField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field: itemField }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Qty</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                disabled={mutation.isPending}
                                {...itemField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field: itemField }) => (
                          <FormItem className="sm:col-span-3">
                            <FormLabel>Unit price</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                disabled={mutation.isPending}
                                {...itemField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end sm:col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={mutation.isPending}
                          onClick={() => items.remove(index)}
                          aria-label="Remove item"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field: itemField }) => (
                          <FormItem className="sm:col-span-10">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={2}
                                placeholder="Optional — helps the hub identify the contents"
                                disabled={mutation.isPending}
                                {...itemField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <LoadingButton type="submit" loading={mutation.isPending}>
                Book parcel
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold">{children}</p>
}

/** Blank item rows are dropped: the dialog starts with none and adds on demand. */
function toCreateBody(values: CreateParcelValues): CreateParcelBody {
  return {
    receiverCustomerId: values.receiverCustomerId.trim(),
    receiverName: values.receiverName.trim(),
    receiverPhone: values.receiverPhone.trim(),
    senderCustomerId: values.senderCustomerId.trim(),
    originHubId: values.originHubId.trim(),
    destinationHubId: values.destinationHubId.trim(),
    originZoneId: values.originZoneId.trim(),
    destinationZoneId: values.destinationZoneId.trim(),
    weight: Number(values.weight),
    length: optionalNumber(values.length),
    width: optionalNumber(values.width),
    height: optionalNumber(values.height),
    parcelType: values.parcelType,
    paymentType: values.paymentType,
    codAmount: optionalNumber(values.codAmount) ?? 0,
    items: values.items
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        name: item.name.trim(),
        description: item.description?.trim() ? item.description.trim() : undefined,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      })),
  }
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  return trimmed === "" ? undefined : Number(trimmed)
}
