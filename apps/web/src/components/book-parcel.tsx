"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LoadingButton,
  QuantityStepper,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Textarea,
} from "@dropx/ui"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  ReceiptIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ReferenceSelect } from "@/components/reference-select"
import { isApiError } from "@/lib/api-client"
import { formatMoney } from "@/lib/format"
import { useCreateParcel, useFeeQuote, useHubs, useRecipients, useZones } from "@/lib/queries"
import { REFERENCE_ENDPOINTS, type ReferenceOption } from "@/lib/reference-data"
import {
  PARCEL_TYPES,
  PAYMENT_TYPES,
  type CreateParcelRequest,
  type DeliveryQuote,
  type PaymentType,
  type QuoteRequest,
} from "@/lib/types"

/**
 * Booking form.
 *
 * Two rules are load-bearing here. The sender is never sent — the API stamps it
 * from the session, and `createOwnParcelSchema` does not even accept the field.
 * And the delivery fee is never sent either: this form shows a quote, but the
 * service recomputes it inside the create transaction, so a tampered fee cannot
 * reach the database.
 *
 * The schema is written over the *string* values the inputs actually hold, and
 * piped into the numbers the API wants, so react-hook-form and zod agree on
 * types without a cast at the call site.
 */

const DECIMAL_PLACES_ERROR = "Use at most 2 decimal places"
const NUMBER_PATTERN = /^\d+(\.\d+)?$/

/**
 * Numeric inputs stay strings all the way through the form.
 *
 * The shared `Form` / `FormField` are bound to the two-generic react-hook-form
 * form, so a schema that *transformed* its output would hand `handleSubmit` a
 * number where the form's own types promise a string. Validating the text and
 * converting once in `toCreateRequest` keeps the two honest: the errors are
 * attached to the keystroke that caused them, and the conversion is the single
 * place that speaks the API's numeric types.
 */
function decimalField(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .regex(NUMBER_PATTERN, `Enter ${label} as a number`)
    .refine((value) => Number.isInteger(Number(value) * 100), { message: DECIMAL_PLACES_ERROR })
    .refine((value) => Number(value) <= max, "That is too large")
}

const moneyField = decimalField("an amount", 1_000_000)

/** A blank dimension means "not measured", which the API treats as absent. */
function optionalDecimalField(max: number) {
  return z
    .string()
    .trim()
    .refine((value) => value === "" || NUMBER_PATTERN.test(value), "Enter a number")
    .refine((value) => value === "" || Number.isInteger(Number(value) * 100), {
      message: DECIMAL_PLACES_ERROR,
    })
    .refine((value) => value === "" || Number(value) <= max, "That is too large")
}

const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(200),
  description: z.string().trim().max(2000, "That description is too long"),
  quantity: z
    .string()
    .trim()
    .min(1, "Enter a quantity")
    .regex(/^\d+$/, "Whole numbers only")
    .refine((value) => Number(value) >= 1, "At least 1")
    .refine((value) => Number(value) <= 9999, "That is too many"),
  unitPrice: moneyField,
})

const bookParcelSchema = z
  .object({
    receiverCustomerId: z.string().trim().min(1, "Pick the receiving customer"),
    receiverName: z.string().trim().min(1, "Receiver name is required").max(150),
    receiverPhone: z.string().trim().min(6, "Enter a valid phone number").max(30),
    originHubId: z.string().trim().min(1, "Pick the hub we collect from"),
    destinationHubId: z.string().trim().min(1, "Pick the hub we deliver from"),
    originZoneId: z.string().trim().min(1, "Pick the origin zone"),
    destinationZoneId: z.string().trim().min(1, "Pick the destination zone"),
    weight: decimalField("a weight", 9999).refine((value) => Number(value) > 0, "Enter a weight"),
    length: optionalDecimalField(9999),
    width: optionalDecimalField(9999),
    height: optionalDecimalField(9999),
    parcelType: z.enum(PARCEL_TYPES),
    paymentType: z.enum(PAYMENT_TYPES),
    codAmount: moneyField,
    items: z.array(itemSchema).max(50, "That is more than 50 items"),
  })
  .refine((values) => values.originHubId !== values.destinationHubId, {
    message: "Origin and destination hub must differ",
    path: ["destinationHubId"],
  })
  .refine((values) => values.paymentType === "COD" || Number(values.codAmount) === 0, {
    message: "Only a cash-on-delivery parcel can collect an amount",
    path: ["codAmount"],
  })

type BookParcelValues = z.infer<typeof bookParcelSchema>

const STEPS = [
  { title: "Receiver", description: "Who gets it" },
  { title: "Route", description: "Where it travels" },
  { title: "Parcel", description: "Size and weight" },
  { title: "Payment", description: "How it is paid" },
  { title: "Review", description: "Check and book" },
] as const

const STEP_FIELDS = [
  ["receiverCustomerId", "receiverName", "receiverPhone"],
  ["originHubId", "destinationHubId", "originZoneId", "destinationZoneId"],
  ["parcelType", "weight", "length", "width", "height"],
  ["paymentType", "codAmount", "items"],
] as const

const EMPTY_ITEM = { name: "", description: "", quantity: "1", unitPrice: "0" } as const

/** A dimension the sender left blank is absent from the body, not zero. */
function toMeasurement(value: string): number | undefined {
  return value === "" ? undefined : Number(value)
}

/** The one place that converts validated text into the API's numeric fields. */
function toCreateRequest(values: BookParcelValues): CreateParcelRequest {
  const length = toMeasurement(values.length)
  const width = toMeasurement(values.width)
  const height = toMeasurement(values.height)

  return {
    receiverCustomerId: values.receiverCustomerId,
    receiverName: values.receiverName,
    receiverPhone: values.receiverPhone,
    originHubId: values.originHubId,
    destinationHubId: values.destinationHubId,
    originZoneId: values.originZoneId,
    destinationZoneId: values.destinationZoneId,
    weight: Number(values.weight),
    ...(length === undefined ? {} : { length }),
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    parcelType: values.parcelType,
    paymentType: values.paymentType,
    codAmount: Number(values.codAmount),
    items: values.items.map((item) => ({
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
  }
}

export function BookParcel() {
  const router = useRouter()
  const [step, setStep] = React.useState(1)

  const form = useForm<BookParcelValues>({
    resolver: zodResolver(bookParcelSchema),
    mode: "onBlur",
    defaultValues: {
      receiverCustomerId: "",
      receiverName: "",
      receiverPhone: "",
      originHubId: "",
      destinationHubId: "",
      originZoneId: "",
      destinationZoneId: "",
      weight: "",
      length: "",
      width: "",
      height: "",
      parcelType: "PACKAGE",
      paymentType: "PREPAID",
      codAmount: "0",
      items: [],
    },
  })

  const items = useFieldArray({ control: form.control, name: "items" })
  const createParcel = useCreateParcel()

  const [serverError, setServerError] = React.useState<string | null>(null)

  const originZoneId = form.watch("originZoneId")
  const destinationZoneId = form.watch("destinationZoneId")
  const weight = form.watch("weight")
  const paymentType = form.watch("paymentType")
  const codAmount = form.watch("codAmount")

  const quoteRequest = React.useMemo<QuoteRequest | null>(() => {
    const weightKg = Number(weight)
    if (!originZoneId || !destinationZoneId) return null
    if (!Number.isFinite(weightKg) || weightKg <= 0) return null

    const collected = Number(codAmount)
    return {
      originZoneId,
      destinationZoneId,
      weightKg,
      /**
       * The parcel DTO has no express flag, so the quote is always the standard
       */
      /**
       * service and `express` is never sent.
       */
      codAmount: paymentType === "COD" && Number.isFinite(collected) ? collected : 0,
      express: false,
    }
  }, [originZoneId, destinationZoneId, weight, codAmount, paymentType])

  const quote = useFeeQuote(quoteRequest)

  const hubs = useHubs()
  const zones = useZones()
  const recipients = useRecipients()

  const hubOptions = hubs.data ?? []
  const zoneOptions = zones.data ?? []
  const recipientOptions = recipients.data ?? []

  /**
   * Booking is impossible until the API can be asked which hubs, zones and
   */
  /**
   * customers exist — a hard-coded id would post a real parcel to a hub nobody
   */
  /**
   * chose.
   */
  const referenceDataReady =
    hubOptions.length > 0 && zoneOptions.length > 0 && recipientOptions.length > 0

  async function goNext() {
    setServerError(null)
    const valid = await form.trigger(STEP_FIELDS[step - 1])
    if (valid) setStep((current) => Math.min(STEPS.length, current + 1))
  }

  function goBack() {
    setServerError(null)
    setStep((current) => Math.max(1, current - 1))
  }

  async function onSubmit(values: BookParcelValues) {
    setServerError(null)

    try {
      const parcel = await createParcel.mutateAsync(toCreateRequest(values))
      toast.success(`Booked — tracking number ${parcel.trackingNumber}`)
      router.push(`/parcels/${parcel.id}`)
    } catch (error) {
      if (isApiError(error)) {
        const fieldErrors = error.fieldErrors
        const fields = Object.keys(fieldErrors) as Array<keyof BookParcelValues>
        for (const field of fields) form.setError(field, { message: fieldErrors[field] })

        const hasFieldErrors = fields.length > 0
        setServerError(
          hasFieldErrors ? "Some details need fixing before we can book this." : error.message,
        )
        return
      }
      setServerError("We could not book that parcel. Please try again.")
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <div className="grid gap-1">
        <p className="text-accent-ink text-xs font-semibold tracking-[0.16em] uppercase">
          Step {step} of {STEPS.length} · {STEPS[step - 1]?.title}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Book a parcel</h1>
        <p className="text-muted-foreground text-sm">
          A few quick steps. You will see the delivery fee before you confirm.
        </p>
      </div>

      {!referenceDataReady ? (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>Booking is not available yet</AlertTitle>
          <AlertDescription>
            <p>
              Booking needs at least one active hub, pricing zone, and recipient customer. Ask DropX
              operations to configure the missing reference data, then try again.
            </p>
            <ul className="mt-2 grid gap-1 text-xs">
              <li>
                Hubs — <code>{REFERENCE_ENDPOINTS.hubs}</code>
              </li>
              <li>
                Zones — <code>{REFERENCE_ENDPOINTS.zones}</code>
              </li>
              <li>
                Recipients — <code>{REFERENCE_ENDPOINTS.recipients}</code>
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6" noValidate>
          <nav
            aria-label="Booking progress"
            className="relative grid gap-3 rounded-2xl border bg-white/60 p-4 sm:grid-cols-5 sm:gap-0 sm:px-6 sm:py-5"
          >
            <span
              className="bg-border absolute top-9 right-[12%] left-[12%] hidden h-px sm:block"
              aria-hidden
            />
            {STEPS.map((item, index) => {
              const number = index + 1
              const active = number === step
              const complete = number < step
              return (
                <button
                  key={item.title}
                  type="button"
                  className="group relative z-10 flex items-center gap-2 text-left sm:grid sm:justify-items-start"
                  onClick={() => number < step && setStep(number)}
                  disabled={number >= step}
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className={
                      complete || active
                        ? "bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        : "bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    }
                  >
                    {complete ? <CheckIcon className="size-4" aria-hidden /> : number}
                  </span>
                  <span className="grid gap-0.5 sm:mt-2">
                    <span
                      className={active ? "text-sm font-semibold" : "text-muted-foreground text-sm"}
                    >
                      {item.title}
                    </span>
                    <span className="text-muted-foreground hidden text-xs sm:block">
                      {item.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.85fr)]">
            <div className="grid gap-6">
              {step === 1 ? (
                <Card className="border-primary/20 bg-primary/[0.025] shadow-sm">
                  <CardHeader>
                    <CardTitle>Receiver</CardTitle>
                    <CardDescription>
                      Who the parcel is going to, and how the rider will reach them.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="receiverCustomerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient account</FormLabel>
                          <ReferenceSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            options={recipientOptions}
                            source="recipients"
                            placeholder="Choose who receives the parcel"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="receiverName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receiver name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Karim Uddin" autoComplete="off" />
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
                                {...field}
                                placeholder="01712345678"
                                inputMode="tel"
                                autoComplete="off"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {step === 2 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Route</CardTitle>
                    <CardDescription>
                      Where we collect from and where it is delivered to. Pricing follows the
                      destination zone.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="originHubId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origin hub</FormLabel>
                          <ReferenceSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            options={hubOptions}
                            source="hubs"
                            placeholder="Pick the collection hub"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="destinationHubId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Destination hub</FormLabel>
                          <ReferenceSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            options={hubOptions}
                            source="hubs"
                            placeholder="Pick the delivery hub"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="originZoneId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origin zone</FormLabel>
                          <ReferenceSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            options={zoneOptions}
                            source="zones"
                            placeholder="Pick the origin zone"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="destinationZoneId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Destination zone</FormLabel>
                          <ReferenceSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            options={zoneOptions}
                            source="zones"
                            placeholder="Pick the destination zone"
                          />
                          <FormDescription>
                            The delivery fee is calculated from this zone.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              ) : null}

              {step === 3 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Parcel</CardTitle>
                    <CardDescription>
                      Weight decides the fee, so it has to be accurate.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="parcelType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parcel type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PARCEL_TYPES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
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
                        name="weight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Weight (kg)</FormLabel>
                            <FormControl>
                              <Input {...field} inputMode="decimal" placeholder="2.5" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="length"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Length (cm)</FormLabel>
                            <FormControl>
                              <Input {...field} inputMode="decimal" placeholder="Optional" />
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
                              <Input {...field} inputMode="decimal" placeholder="Optional" />
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
                              <Input {...field} inputMode="decimal" placeholder="Optional" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {step === 4 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Payment</CardTitle>
                    <CardDescription>
                      Prepaid is charged up front. Cash on delivery is collected by the rider from
                      the receiver.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="paymentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment type</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => field.onChange(value as PaymentType)}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PAYMENT_TYPES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value === "PREPAID" ? "Prepaid" : "Cash on delivery"}
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
                        name="codAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount to collect (BDT)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                inputMode="decimal"
                                disabled={paymentType !== "COD"}
                                placeholder={
                                  paymentType === "COD" ? "0" : "Prepaid — nothing to collect"
                                }
                              />
                            </FormControl>
                            <FormDescription>
                              Leave at 0 if the receiver pays nothing.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {step === 4 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Items</CardTitle>
                    <CardDescription>
                      Optional, and not priced for shipping — it helps the receiver check the
                      parcel.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {items.fields.length === 0 ? (
                      <div className="bg-muted/35 rounded-xl px-4 py-3 text-sm">
                        <p className="font-medium">No items added</p>
                        <p className="text-muted-foreground mt-1">
                          Optional. Add contents if the receiver needs to check what is inside.
                        </p>
                      </div>
                    ) : null}

                    {items.fields.map((field, index) => (
                      <div key={field.id} className="bg-muted/20 grid gap-3 rounded-xl border p-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">Item {index + 1}</Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => items.remove(index)}
                          >
                            <Trash2Icon aria-hidden />
                            Remove
                          </Button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                          <FormField
                            control={form.control}
                            name={`items.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Cotton shirt" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantity</FormLabel>
                                <FormControl>
                                  <QuantityStepper
                                    value={Number(field.value)}
                                    min={1}
                                    max={9999}
                                    onValueChange={(next) => field.onChange(String(next))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Unit price (BDT)</FormLabel>
                                <FormControl>
                                  <Input {...field} inputMode="decimal" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`items.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea {...field} rows={2} placeholder="Optional" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}

                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => items.append({ ...EMPTY_ITEM })}
                        disabled={items.fields.length >= 50}
                      >
                        <PlusIcon aria-hidden />
                        Add an item
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {step === 5 ? (
                <ReviewCard
                  values={form.getValues()}
                  hubOptions={hubOptions}
                  zoneOptions={zoneOptions}
                  recipientOptions={recipientOptions}
                  quote={quote.data}
                />
              ) : null}
            </div>

            <div className="grid h-fit gap-4 lg:sticky lg:top-24">
              <Card className="border-primary/20 bg-primary/[0.025] shadow-sm">
                <CardHeader className="gap-1 pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptIcon className="size-4" aria-hidden />
                    Delivery fee
                  </CardTitle>
                  <CardDescription>
                    Your live estimate. It is confirmed again when you book.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {!quoteRequest ? (
                    <p className="text-muted-foreground text-sm">
                      Pick both zones and enter a weight to see a fee.
                    </p>
                  ) : quote.isPending ? (
                    <div className="grid gap-2" aria-busy="true">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : quote.isError ? (
                    <Alert variant="warning">
                      <TriangleAlertIcon aria-hidden />
                      <AlertTitle>No price for that combination</AlertTitle>
                      <AlertDescription>
                        {isApiError(quote.error)
                          ? quote.error.message
                          : "We could not reach the pricing service."}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <dl className="grid gap-2 text-sm">
                      <QuoteRow
                        label="Base price"
                        value={formatMoney(quote.data.basePrice, quote.data.currency)}
                      />
                      <QuoteRow
                        label={`Weight charge (${weight} kg)`}
                        value={formatMoney(quote.data.weightCharge, quote.data.currency)}
                      />
                      {quote.data.codFee > 0 ? (
                        <QuoteRow
                          label="Cash on delivery fee"
                          value={formatMoney(quote.data.codFee, quote.data.currency)}
                        />
                      ) : null}
                      <Separator />
                      <div className="flex items-center justify-between">
                        <dt className="font-medium">Total</dt>
                        <dd className="text-lg font-semibold tabular-nums">
                          {formatMoney(quote.data.total, quote.data.currency)}
                        </dd>
                      </div>
                    </dl>
                  )}

                  <p className="text-muted-foreground text-xs leading-5">
                    Based on your route, weight, and COD amount. DropX recomputes it at booking.
                  </p>
                </CardContent>
              </Card>

              {serverError ? (
                <Alert variant="destructive">
                  <TriangleAlertIcon aria-hidden />
                  <AlertTitle>We could not book that parcel</AlertTitle>
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex gap-3">
                {step > 1 ? (
                  <Button type="button" variant="outline" onClick={goBack} className="flex-1">
                    <ArrowLeftIcon aria-hidden />
                    Back
                  </Button>
                ) : null}
                {step < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={() => void goNext()}
                    className="flex-1"
                    disabled={!referenceDataReady}
                  >
                    Continue
                    <ArrowRightIcon aria-hidden />
                  </Button>
                ) : (
                  <LoadingButton
                    type="submit"
                    loading={createParcel.isPending}
                    disabled={!referenceDataReady}
                    className="flex-1"
                  >
                    {createParcel.isPending ? "Booking…" : "Confirm and book"}
                    <CheckIcon aria-hidden />
                  </LoadingButton>
                )}
              </div>

              {!referenceDataReady ? (
                <p className="text-muted-foreground text-xs">
                  Booking is disabled until the hub, zone and recipient lists are available.
                </p>
              ) : null}
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

function ReviewCard({
  values,
  hubOptions,
  zoneOptions,
  recipientOptions,
  quote,
}: {
  values: BookParcelValues
  hubOptions: ReferenceOption[]
  zoneOptions: ReferenceOption[]
  recipientOptions: ReferenceOption[]
  quote: DeliveryQuote | undefined
}) {
  const labelFor = (options: ReferenceOption[], id: string) =>
    options.find((option) => option.id === id)?.label ?? id

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review your booking</CardTitle>
        <CardDescription>
          Everything look right? You can go back to make changes before booking.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ReviewGroup title="Receiver">
          <ReviewRow
            label="Customer"
            value={labelFor(recipientOptions, values.receiverCustomerId)}
          />
          <ReviewRow label="Name" value={values.receiverName} />
          <ReviewRow label="Phone" value={values.receiverPhone} />
        </ReviewGroup>
        <ReviewGroup title="Route">
          <ReviewRow label="From" value={labelFor(hubOptions, values.originHubId)} />
          <ReviewRow label="To" value={labelFor(hubOptions, values.destinationHubId)} />
          <ReviewRow
            label="Zones"
            value={`${labelFor(zoneOptions, values.originZoneId)} → ${labelFor(zoneOptions, values.destinationZoneId)}`}
          />
        </ReviewGroup>
        <ReviewGroup title="Parcel and payment">
          <ReviewRow label="Details" value={`${values.parcelType} · ${values.weight} kg`} />
          <ReviewRow
            label="Payment"
            value={
              values.paymentType === "COD"
                ? `Cash on delivery · ${formatMoney(Number(values.codAmount))}`
                : "Prepaid"
            }
          />
          <ReviewRow
            label="Items"
            value={
              values.items.length === 0
                ? "None listed"
                : `${values.items.length} item${values.items.length === 1 ? "" : "s"}`
            }
          />
        </ReviewGroup>
        {quote ? (
          <div className="bg-primary/8 flex items-center justify-between rounded-xl px-4 py-3">
            <span className="text-sm font-medium">Estimated delivery fee</span>
            <span className="text-lg font-bold tabular-nums">
              {formatMoney(quote.total, quote.currency)}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ReviewGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <h3 className="text-accent-ink text-xs font-semibold tracking-[0.16em] uppercase">{title}</h3>
      <div className="bg-muted/35 grid gap-2 rounded-xl p-3">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
