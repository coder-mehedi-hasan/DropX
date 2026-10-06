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
  Separator,
  Skeleton,
  Textarea,
  cn,
  useConfirmation,
} from "@dropx/ui"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanknoteIcon,
  BoxIcon,
  CheckIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileTextIcon,
  GemIcon,
  MapPinIcon,
  PackageIcon,
  PlusIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  ShapesIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserRoundIcon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { PageHeader } from "@/components/page-header"
import { ReferenceSelect } from "@/components/reference-select"
import { isApiError } from "@/lib/api-client"
import { formatMoney } from "@/lib/format"
import { useCreateParcel, useFeeQuote, useHubs, useZones } from "@/lib/queries"
import { type ReferenceOption } from "@/lib/reference-data"
import {
  PARCEL_TYPES,
  PAYMENT_TYPES,
  type CreateParcelRequest,
  type DeliveryQuote,
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
    receiverName: z.string().trim().min(1, "Receiver name is required").max(150),
    receiverPhone: z.string().trim().min(6, "Enter a valid phone number").max(30),
    receiverSecondaryPhone: z
      .string()
      .trim()
      .max(30)
      .refine((value) => value === "" || value.length >= 6, "Enter a valid phone number"),
    receiverAddress: z.string().trim().min(1, "Receiver address is required").max(300),
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
  { title: "Receiver", description: "Who gets it", icon: UserRoundIcon },
  { title: "Route", description: "Where it travels", icon: MapPinIcon },
  { title: "Parcel", description: "Size and weight", icon: BoxIcon },
  { title: "Payment", description: "How it is paid", icon: WalletCardsIcon },
  { title: "Review", description: "Check and book", icon: ClipboardCheckIcon },
] as const

const PROGRESS_WIDTHS = ["w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"] as const

const PARCEL_TYPE_OPTIONS = {
  DOCUMENT: { label: "Document", description: "Paperwork and flat mail", icon: FileTextIcon },
  PACKAGE: { label: "Package", description: "Everyday boxed goods", icon: PackageIcon },
  FRAGILE: { label: "Fragile", description: "Handle with extra care", icon: GemIcon },
  OTHER: { label: "Other", description: "Anything that does not fit", icon: ShapesIcon },
} satisfies Record<
  (typeof PARCEL_TYPES)[number],
  { label: string; description: string; icon: LucideIcon }
>

const PAYMENT_TYPE_OPTIONS = {
  PREPAID: {
    label: "Prepaid",
    description: "The delivery fee is paid before dispatch.",
    icon: CreditCardIcon,
  },
  COD: {
    label: "Cash on delivery",
    description: "The rider collects payment from the receiver.",
    icon: BanknoteIcon,
  },
} satisfies Record<
  (typeof PAYMENT_TYPES)[number],
  { label: string; description: string; icon: LucideIcon }
>

const STEP_FIELDS = [
  ["receiverName", "receiverPhone", "receiverSecondaryPhone", "receiverAddress"],
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
    receiverName: values.receiverName,
    receiverPhone: values.receiverPhone,
    ...(values.receiverSecondaryPhone
      ? { receiverSecondaryPhone: values.receiverSecondaryPhone }
      : {}),
    receiverAddress: values.receiverAddress,
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
      receiverName: "",
      receiverPhone: "",
      receiverSecondaryPhone: "",
      receiverAddress: "",
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
  const { confirm, confirmationDialog } = useConfirmation()

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

  const hubOptions = hubs.data ?? []
  const zoneOptions = zones.data ?? []

  /**
   * Booking is impossible until the API can be asked which hubs and zones
   * exist — a hard-coded id would post a real parcel to a hub nobody chose.
   */
  const referenceDataReady = hubOptions.length > 0 && zoneOptions.length > 0

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

    const quoted = quote.data
    const codOnDelivery =
      values.paymentType === "COD" && Number(values.codAmount) > 0
        ? formatMoney(Number(values.codAmount), quoted?.currency)
        : null

    const ok = await confirm({
      title: "Book this parcel?",
      description: (
        <span className="grid gap-1.5">
          <span>
            Sending to {values.receiverName} ({values.receiverPhone}), at {values.receiverAddress}.
          </span>
          {quoted ? <span>Estimated fee {formatMoney(quoted.total, quoted.currency)}.</span> : null}
          {codOnDelivery ? <span>Collected on delivery: {codOnDelivery}.</span> : null}
          <span>The server recalculates the final fee when the parcel is created.</span>
        </span>
      ),
      confirmLabel: "Book parcel",
      destructive: false,
    })
    if (!ok) return

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
    <div className="max-w-page mx-auto grid w-full gap-7">
      {confirmationDialog}
      <PageHeader
        eyebrow="New shipment"
        title="Book a parcel with confidence."
        description="Tell us where it is going and what is inside. Your delivery fee updates as soon as the route and weight are ready."
      />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-6 [&_[data-slot=input]]:h-12 [&_[data-slot=select-trigger]]:h-12 [&_[data-slot=select-trigger]]:bg-[#FBFBFC] [&_textarea]:bg-[#FBFBFC]"
          noValidate
        >
          <nav
            aria-label="Booking progress"
            className="relative overflow-hidden rounded-2xl bg-white p-2 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.28)] ring-1 ring-black/5"
          >
            <div className="grid grid-cols-5 gap-1">
              {STEPS.map((item, index) => {
                const number = index + 1
                const active = number === step
                const complete = number < step
                const Icon = item.icon
                return (
                  <button
                    key={item.title}
                    type="button"
                    className={cn(
                      "group relative flex min-w-0 items-center gap-2 rounded-xl px-2 py-3 text-left transition-all duration-200 sm:px-3",
                      active
                        ? "bg-[#0D0F12] text-white shadow-[0_12px_28px_-18px_rgba(13,15,18,.9)]"
                        : complete
                          ? "text-foreground hover:bg-[#F7F8FA]"
                          : "text-muted-foreground",
                    )}
                    onClick={() => number < step && setStep(number)}
                    disabled={number >= step}
                    aria-current={active ? "step" : undefined}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        active
                          ? "bg-[#FF5500] text-white"
                          : complete
                            ? "bg-primary/10 text-accent-ink"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {complete ? (
                        <CheckIcon className="size-4" aria-hidden />
                      ) : (
                        <Icon className="size-4" aria-hidden />
                      )}
                    </span>
                    <span className="hidden min-w-0 lg:grid">
                      <span className="truncate text-sm font-semibold">{item.title}</span>
                      <span
                        className={cn(
                          "truncate text-[0.68rem]",
                          active ? "text-white/55" : "text-muted-foreground",
                        )}
                      >
                        {item.description}
                      </span>
                    </span>
                    <span className="sr-only lg:hidden">
                      Step {number}: {item.title}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex items-center gap-3 px-2 pb-1 sm:px-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ECEEF1]" aria-hidden>
                <div
                  className={cn(
                    "ease-brand h-full rounded-full bg-[#FF5500] transition-[width] duration-300",
                    PROGRESS_WIDTHS[step - 1],
                  )}
                />
              </div>
              <p className="text-muted-foreground text-xs font-semibold tabular-nums">
                {step}/{STEPS.length}
              </p>
            </div>
          </nav>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(19rem,0.8fr)]">
            <div className="grid gap-6">
              {step === 1 ? (
                <Card className="overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
                  <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-7">
                    <BookingCardTitle icon={UserRoundIcon} step="01" title="Receiver details" />
                    <CardDescription>
                      Who the parcel is going to, and how the rider will reach them. The receiver
                      does not need a DropX account.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6 px-5 py-6 sm:px-7 sm:py-7">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="receiverName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receiver full name</FormLabel>
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

                      <FormField
                        control={form.control}
                        name="receiverSecondaryPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary phone</FormLabel>
                            <FormDescription>
                              Optional — a backup way to reach them.
                            </FormDescription>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="01812345678"
                                inputMode="tel"
                                autoComplete="off"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="receiverAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery address</FormLabel>
                          <FormDescription>
                            Where the rider hands the parcel over. Include the area, landmark and
                            house details.
                          </FormDescription>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={3}
                              placeholder="House 12, Road 7, Dhanmondi, Dhaka"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              ) : null}

              {step === 2 ? (
                <Card className="overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
                  <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-7">
                    <BookingCardTitle
                      icon={MapPinIcon}
                      step="02"
                      title="Pickup and delivery route"
                    />
                    <CardDescription>
                      Where we collect from and where it is delivered to. Pricing follows the
                      destination zone.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6 px-5 py-6 sm:grid-cols-2 sm:px-7 sm:py-7">
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
                <Card className="overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
                  <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-7">
                    <BookingCardTitle icon={BoxIcon} step="03" title="Parcel details" />
                    <CardDescription>
                      Weight decides the fee, so it has to be accurate.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6 px-5 py-6 sm:px-7 sm:py-7">
                    <FormField
                      control={form.control}
                      name="parcelType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parcel type</FormLabel>
                          <div
                            className="grid gap-3 sm:grid-cols-2"
                            role="radiogroup"
                            aria-label="Parcel type"
                          >
                            {PARCEL_TYPES.map((value) => (
                              <ChoiceTile
                                key={value}
                                name="parcelType"
                                value={value}
                                selected={field.value === value}
                                option={PARCEL_TYPE_OPTIONS[value]}
                                onSelect={() => field.onChange(value)}
                                onBlur={field.onBlur}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem className="max-w-sm">
                          <FormLabel>Weight (kg)</FormLabel>
                          <FormControl>
                            <Input {...field} inputMode="decimal" placeholder="2.5" />
                          </FormControl>
                          <FormDescription>
                            Use the packed weight, including wrapping.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-xl bg-[#F7F8FA] p-4 sm:p-5">
                      <div className="mb-4">
                        <p className="text-sm font-semibold">Measurements</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Optional, but useful for large or unusually shaped parcels.
                        </p>
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
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {step === 4 ? (
                <Card className="overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
                  <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-7">
                    <BookingCardTitle icon={WalletCardsIcon} step="04" title="Payment" />
                    <CardDescription>
                      Prepaid is charged up front. Cash on delivery is collected by the rider from
                      the receiver.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6 px-5 py-6 sm:px-7 sm:py-7">
                    <FormField
                      control={form.control}
                      name="paymentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment type</FormLabel>
                          <div
                            className="grid gap-3 sm:grid-cols-2"
                            role="radiogroup"
                            aria-label="Payment type"
                          >
                            {PAYMENT_TYPES.map((value) => (
                              <ChoiceTile
                                key={value}
                                name="paymentType"
                                value={value}
                                selected={field.value === value}
                                option={PAYMENT_TYPE_OPTIONS[value]}
                                onSelect={() => {
                                  field.onChange(value)
                                  if (value === "PREPAID") {
                                    form.setValue("codAmount", "0", { shouldValidate: false })
                                  }
                                }}
                                onBlur={field.onBlur}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {paymentType === "COD" ? (
                      <FormField
                        control={form.control}
                        name="codAmount"
                        render={({ field }) => (
                          <FormItem className="max-w-sm rounded-xl bg-[#F7F8FA] p-4 ring-1 ring-black/5">
                            <FormLabel>Amount to collect (BDT)</FormLabel>
                            <FormControl>
                              <Input {...field} inputMode="decimal" placeholder="0" />
                            </FormControl>
                            <FormDescription>
                              Enter what the rider should collect from the receiver.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="flex items-start gap-3 rounded-xl bg-[#F7F8FA] p-4 text-sm ring-1 ring-black/5">
                        <ShieldCheckIcon
                          className="text-success mt-0.5 size-4 shrink-0"
                          aria-hidden
                        />
                        <div>
                          <p className="font-medium">No cash collection</p>
                          <p className="text-muted-foreground mt-1 text-xs leading-5">
                            The receiver will not be asked to pay when the parcel arrives.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {step === 4 ? (
                <Card className="overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
                  <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-7">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <CardTitle>What is inside?</CardTitle>
                        <CardDescription className="mt-1.5">
                          Optional. A contents list helps the receiver check the parcel.
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 bg-white"
                        onClick={() => items.append({ ...EMPTY_ITEM })}
                        disabled={items.fields.length >= 50}
                      >
                        <PlusIcon aria-hidden />
                        Add item
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 px-5 py-6 sm:px-7 sm:py-7">
                    {items.fields.length === 0 ? (
                      <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-black/12 bg-[#F7F8FA] px-6 py-8 text-center">
                        <span className="text-muted-foreground flex size-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
                          <BoxIcon className="size-5" aria-hidden />
                        </span>
                        <p className="mt-3 text-sm font-semibold">No contents listed</p>
                        <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-5">
                          You can book without a contents list, or add items for a clearer handover.
                        </p>
                      </div>
                    ) : null}

                    {items.fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="grid gap-4 rounded-xl bg-[#F7F8FA] p-4 ring-1 ring-black/5 sm:p-5"
                      >
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
                  </CardContent>
                </Card>
              ) : null}

              {step === 5 ? (
                <ReviewCard
                  values={form.getValues()}
                  hubOptions={hubOptions}
                  zoneOptions={zoneOptions}
                  quote={quote.data}
                />
              ) : null}
            </div>

            <aside className="grid h-fit gap-4 lg:sticky lg:top-6" aria-label="Booking summary">
              <Card className="relative overflow-hidden border-0 bg-[#0D0F12] py-0 text-white shadow-[0_24px_60px_-30px_rgba(13,15,18,.9)]">
                <div className="pointer-events-none absolute -top-20 -right-16 size-52 rounded-full bg-[#FF5500]/20 blur-3xl" />
                <CardHeader className="relative gap-1 px-5 pt-6 pb-4">
                  <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#FF5500] text-white shadow-[0_10px_24px_-12px_rgba(255,85,0,.9)]">
                    <ReceiptIcon className="size-5" aria-hidden />
                  </span>
                  <CardTitle className="text-lg">Live delivery estimate</CardTitle>
                  <CardDescription className="text-[#A7ABB4]">
                    Updates from the route, weight, and collection amount.
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative grid gap-4 px-5 pb-6">
                  {!quoteRequest ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-medium text-white">Waiting for route and weight</p>
                      <p className="mt-1 text-xs leading-5 text-[#A7ABB4]">
                        Complete the route and parcel steps to calculate the fee.
                      </p>
                    </div>
                  ) : quote.isPending ? (
                    <div className="grid gap-2" aria-busy="true">
                      <Skeleton className="h-4 w-full bg-white/10" />
                      <Skeleton className="h-4 w-2/3 bg-white/10" />
                      <Skeleton className="h-12 w-full bg-white/10" />
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
                    <dl className="grid gap-3 text-sm">
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
                      <Separator className="bg-white/10" />
                      <div className="flex items-end justify-between gap-4 pt-1">
                        <dt className="text-sm font-medium text-[#A7ABB4]">Estimated total</dt>
                        <dd className="text-2xl font-extrabold tracking-[-0.04em] text-white tabular-nums">
                          {formatMoney(quote.data.total, quote.data.currency)}
                        </dd>
                      </div>
                    </dl>
                  )}

                  <div className="flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-[#A7ABB4]">
                    <ShieldCheckIcon
                      className="mt-0.5 size-4 shrink-0 text-[#FF8A4C]"
                      aria-hidden
                    />
                    <p>
                      DropX recomputes the price when you confirm, so the server always applies the
                      correct rule.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {serverError ? (
                <Alert variant="destructive">
                  <TriangleAlertIcon aria-hidden />
                  <AlertTitle>We could not book that parcel</AlertTitle>
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex gap-3 rounded-2xl bg-white p-2 shadow-[0_12px_32px_-26px_rgba(13,15,18,.55)] ring-1 ring-black/5">
                {step > 1 ? (
                  <Button type="button" variant="ghost" onClick={goBack} className="flex-1">
                    <ArrowLeftIcon aria-hidden />
                    Back
                  </Button>
                ) : null}
                {step < STEPS.length ? (
      <Button
        type="button"
        onClick={() => void goNext()}
        className="flex-1 shadow-[0_10px_22px_-12px_rgba(255,85,0,.75)]"
        disabled={step > 1 && !referenceDataReady}
      >
        Continue
        <ArrowRightIcon aria-hidden />
      </Button>
                ) : (
                  <LoadingButton
                    type="submit"
                    loading={createParcel.isPending}
                    disabled={!referenceDataReady}
                    className="flex-1 shadow-[0_10px_22px_-12px_rgba(255,85,0,.75)]"
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
            </aside>
          </div>
        </form>
      </Form>
    </div>
  )
}

function ChoiceTile({
  name,
  value,
  selected,
  option,
  onSelect,
  onBlur,
}: {
  name: string
  value: string
  selected: boolean
  option: { label: string; description: string; icon: LucideIcon }
  onSelect: () => void
  onBlur: () => void
}) {
  const Icon = option.icon

  return (
    <label className="group cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        onBlur={onBlur}
        className="peer sr-only"
      />
      <span
        className={cn(
          "ease-brand peer-focus-visible:ring-primary flex min-h-24 items-start gap-3 rounded-xl p-4 ring-1 transition-[background-color,box-shadow,transform] duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 active:scale-[0.99]",
          selected
            ? "bg-primary/8 ring-primary/35"
            : "bg-[#FBFBFC] ring-black/7 group-hover:bg-white group-hover:ring-black/14",
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            selected ? "bg-[#FF5500] text-white" : "text-muted-foreground bg-white shadow-sm",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2 text-sm font-semibold">
            {option.label}
            {selected ? (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0D0F12] text-white">
                <CheckIcon className="size-3" aria-hidden />
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground mt-1 block text-xs leading-5">
            {option.description}
          </span>
        </span>
      </span>
    </label>
  )
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#A7ABB4]">{label}</dt>
      <dd className="font-medium text-white tabular-nums">{value}</dd>
    </div>
  )
}

function BookingCardTitle({
  icon: Icon,
  step,
  title,
}: {
  icon: LucideIcon
  step: string
  title: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-primary/10 text-accent-ink flex size-10 items-center justify-center rounded-xl">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-accent-ink text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
          Step {step}
        </p>
        <CardTitle className="mt-1 text-lg">{title}</CardTitle>
      </div>
    </div>
  )
}

function ReviewCard({
  values,
  hubOptions,
  zoneOptions,
  quote,
}: {
  values: BookParcelValues
  hubOptions: ReferenceOption[]
  zoneOptions: ReferenceOption[]
  quote: DeliveryQuote | undefined
}) {
  const labelFor = (options: ReferenceOption[], id: string) =>
    options.find((option) => option.id === id)?.label ?? id

  return (
    <Card className="overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
      <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-7">
        <BookingCardTitle icon={ClipboardCheckIcon} step="05" title="Review your booking" />
        <CardDescription>Check the handover details before creating the parcel.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <ReviewGroup title="Receiver" icon={UserRoundIcon}>
            <ReviewRow label="Name" value={values.receiverName} />
            <ReviewRow label="Phone" value={values.receiverPhone} />
            {values.receiverSecondaryPhone ? (
              <ReviewRow label="Secondary phone" value={values.receiverSecondaryPhone} />
            ) : null}
            <ReviewRow label="Address" value={values.receiverAddress} />
          </ReviewGroup>
          <ReviewGroup title="Route" icon={MapPinIcon}>
            <ReviewRow label="From" value={labelFor(hubOptions, values.originHubId)} />
            <ReviewRow label="To" value={labelFor(hubOptions, values.destinationHubId)} />
            <ReviewRow
              label="Zones"
              value={`${labelFor(zoneOptions, values.originZoneId)} → ${labelFor(zoneOptions, values.destinationZoneId)}`}
            />
          </ReviewGroup>
        </div>
        <ReviewGroup title="Parcel and payment" icon={BoxIcon}>
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
          <div className="flex items-center justify-between rounded-xl bg-[#0D0F12] px-5 py-4 text-white">
            <span className="text-sm font-medium text-[#C8CBD1]">Estimated delivery fee</span>
            <span className="text-xl font-extrabold tracking-[-0.03em] tabular-nums">
              {formatMoney(quote.total, quote.currency)}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ReviewGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 rounded-xl bg-[#F7F8FA] p-4 ring-1 ring-black/5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="text-accent-ink size-4" aria-hidden />
        {title}
      </h3>
      <div className="grid gap-2.5">{children}</div>
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
