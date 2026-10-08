"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { PageHeader } from "@/components/page-header"
import { ReferenceSelect } from "@/components/reference-select"
import MapAddressPicker, { type MapPoint } from "@/components/address/map-address-picker"
import { useParcelDraft } from "@/components/use-parcel-draft"
import { isApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { formatMoney } from "@/lib/format"
import {
  useCities,
  useCityZones,
  useCreateParcel,
  useFeeQuote,
  useSavedAddresses,
  useZoneAreas,
} from "@/lib/queries"
import { type ReferenceOption } from "@/lib/reference-data"
import {
  PARCEL_TYPES,
  PAYMENT_TYPES,
  type CreateParcelRequest,
  type CustomerAddress,
  type FeeQuote,
  type QuoteRequest,
} from "@/lib/types"

/**
 * Booking form.
 *
 * Three rules are load-bearing here. The sender is never sent — the API stamps it
 * from the session, and `createOwnParcelSchema` does not even accept the field.
 * The hub ids are never sent either: a booking is addressed, not routed, and the
 * service picks the origin and destination hubs from the map coordinates below.
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

/**
 * A coordinate the map wrote, held as text like every other input here: blank
 * until a pin exists, then a finite number inside the WGS84 range for its axis.
 */
function coordinateField(min: number, max: number) {
  return z
    .string()
    .refine(
      (value) =>
        value === "" ||
        (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max),
      "That is not a valid location",
    )
}

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
    deliveryCityId: z.string().trim().min(1, "Pick the delivery city"),
    deliveryZoneId: z.string().trim().min(1, "Pick the delivery zone"),
    deliveryAreaId: z.string(),
    deliveryAddressLine: z
      .string()
      .trim()
      .min(1, "Enter the house, building or flat details")
      .max(300),
    pickupCityId: z.string().trim().min(1, "Pick the pickup city"),
    pickupZoneId: z.string().trim().min(1, "Pick the pickup zone"),
    pickupAreaId: z.string(),
    pickupAddressLine: z
      .string()
      .trim()
      .min(1, "Enter the house, building or flat details")
      .max(300),
    pickupLatitude: coordinateField(-90, 90),
    pickupLongitude: coordinateField(-180, 180),
    deliveryLatitude: coordinateField(-90, 90),
    deliveryLongitude: coordinateField(-180, 180),
    weight: decimalField("a weight", 9999).refine((value) => Number(value) > 0, "Enter a weight"),
    length: optionalDecimalField(9999),
    width: optionalDecimalField(9999),
    height: optionalDecimalField(9999),
    parcelType: z.enum(PARCEL_TYPES),
    paymentType: z.enum(PAYMENT_TYPES),
    codAmount: moneyField,
    items: z.array(itemSchema).max(50, "That is more than 50 items"),
  })
  .refine((values) => values.paymentType === "COD" || Number(values.codAmount) === 0, {
    message: "Only a cash-on-delivery parcel can collect an amount",
    path: ["codAmount"],
  })

type BookParcelValues = z.infer<typeof bookParcelSchema>

/**
 * The untouched form, as a named constant so the draft restore can rebuild it
 * by spreading the saved payload over a complete, valid set of values — a
 * half-filled draft merged onto inline defaults would drift the moment either
 * side changed shape.
 */
const EMPTY_BOOKING_VALUES: BookParcelValues = {
  receiverName: "",
  receiverPhone: "",
  receiverSecondaryPhone: "",
  deliveryCityId: "",
  deliveryZoneId: "",
  deliveryAreaId: "",
  deliveryAddressLine: "",
  pickupCityId: "",
  pickupZoneId: "",
  pickupAreaId: "",
  pickupAddressLine: "",
  pickupLatitude: "",
  pickupLongitude: "",
  deliveryLatitude: "",
  deliveryLongitude: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  parcelType: "PACKAGE",
  paymentType: "PREPAID",
  codAmount: "0",
  items: [],
}

const STEPS = [
  { title: "Receiver", description: "Who gets it", icon: UserRoundIcon },
  { title: "Address", description: "Pickup and drop-off", icon: MapPinIcon },
  { title: "Parcel", description: "Size and weight", icon: BoxIcon },
  { title: "Items", description: "Optional contents", icon: PackageIcon },
  { title: "Payment", description: "How it is paid", icon: WalletCardsIcon },
  { title: "Review", description: "Check and book", icon: ClipboardCheckIcon },
] as const

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
  ["receiverName", "receiverPhone", "receiverSecondaryPhone"],
  [
    "deliveryCityId",
    "deliveryZoneId",
    "deliveryAreaId",
    "deliveryAddressLine",
    "deliveryLatitude",
    "deliveryLongitude",
    "pickupCityId",
    "pickupZoneId",
    "pickupAreaId",
    "pickupAddressLine",
    "pickupLatitude",
    "pickupLongitude",
  ],
  ["parcelType", "weight", "length", "width", "height"],
  ["items"],
  ["paymentType", "codAmount"],
] as const

const EMPTY_ITEM = { name: "", description: "", quantity: "1", unitPrice: "0" } as const

/** A dimension the sender left blank is absent from the body, not zero. */
function toMeasurement(value: string): number | undefined {
  return value === "" ? undefined : Number(value)
}

/**
 * One end of a booking, for review or the confirm dialog: address line first,
 * then the cascade's area, zone and city labels.
 */
function joinedAddress(
  values: BookParcelValues,
  end: "pickup" | "delivery",
  cities: ReferenceOption[],
  zones: ReferenceOption[],
  areas: ReferenceOption[],
): string {
  const labelFor = (options: ReferenceOption[], id: string) =>
    options.find((option) => option.id === id)?.label ?? id

  const line = end === "pickup" ? values.pickupAddressLine : values.deliveryAddressLine
  const areaId = end === "pickup" ? values.pickupAreaId : values.deliveryAreaId
  const zoneId = end === "pickup" ? values.pickupZoneId : values.deliveryZoneId
  const cityId = end === "pickup" ? values.pickupCityId : values.deliveryCityId

  return [
    line,
    areaId ? labelFor(areas, areaId) : null,
    labelFor(zones, zoneId),
    labelFor(cities, cityId),
  ]
    .filter(Boolean)
    .join(", ")
}

/** A coordinate the map left blank stays absent, so the server falls back. */
function toCoordinate(value: string): number | undefined {
  return value === "" ? undefined : Number(value)
}

/** The one place that converts validated text into the API's numeric fields. */
function toCreateRequest(values: BookParcelValues): CreateParcelRequest {
  const length = toMeasurement(values.length)
  const width = toMeasurement(values.width)
  const height = toMeasurement(values.height)
  const pickupLatitude = toCoordinate(values.pickupLatitude)
  const pickupLongitude = toCoordinate(values.pickupLongitude)
  const deliveryLatitude = toCoordinate(values.deliveryLatitude)
  const deliveryLongitude = toCoordinate(values.deliveryLongitude)

  return {
    receiverName: values.receiverName,
    receiverPhone: values.receiverPhone,
    ...(values.receiverSecondaryPhone
      ? { receiverSecondaryPhone: values.receiverSecondaryPhone }
      : {}),
    pickupAddress: {
      cityId: values.pickupCityId,
      zoneId: values.pickupZoneId,
      ...(values.pickupAreaId ? { areaId: values.pickupAreaId } : {}),
      addressLine: values.pickupAddressLine,
      ...(pickupLatitude !== undefined ? { latitude: pickupLatitude } : {}),
      ...(pickupLongitude !== undefined ? { longitude: pickupLongitude } : {}),
    },
    deliveryAddress: {
      cityId: values.deliveryCityId,
      zoneId: values.deliveryZoneId,
      ...(values.deliveryAreaId ? { areaId: values.deliveryAreaId } : {}),
      addressLine: values.deliveryAddressLine,
      ...(deliveryLatitude !== undefined ? { latitude: deliveryLatitude } : {}),
      ...(deliveryLongitude !== undefined ? { longitude: deliveryLongitude } : {}),
    },
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
  const { status: authStatus } = useAuth()
  const [step, setStep] = React.useState(1)

  const form = useForm<BookParcelValues>({
    resolver: zodResolver(bookParcelSchema),
    mode: "onBlur",
    defaultValues: EMPTY_BOOKING_VALUES,
  })

  const items = useFieldArray({ control: form.control, name: "items" })
  const createParcel = useCreateParcel()
  const { confirm, confirmationDialog } = useConfirmation()

  const [serverError, setServerError] = React.useState<string | null>(null)

  /**
   * Draft autosave: every field change is debounced into a POST, the stored
   * draft is restored on arrival (unless the customer already started typing),
   * and a successful booking deletes the row. Signed-out visitors get none of
   * it — the endpoints require an ACTIVE session.
   */
  const { status: draftStatus, discard: discardDraft } = useParcelDraft<BookParcelValues>({
    form,
    enabled: authStatus === "authenticated",
    paused: createParcel.isPending,
    restore: (payload) => {
      form.reset({ ...EMPTY_BOOKING_VALUES, ...payload } as BookParcelValues)
      setStep(payload.step ?? 1)
    },
  })

  const pickedCityId = form.watch("pickupCityId")
  const pickedZoneId = form.watch("pickupZoneId")
  const deliveredCityId = form.watch("deliveryCityId")
  const deliveredZoneId = form.watch("deliveryZoneId")
  const weight = form.watch("weight")
  const paymentType = form.watch("paymentType")
  const codAmount = form.watch("codAmount")

  const quoteRequest = React.useMemo<QuoteRequest | null>(() => {
    if (!pickedCityId || !pickedZoneId || !deliveredCityId || !deliveredZoneId) return null
    const weightKg = Number(weight)
    if (!Number.isFinite(weightKg) || weightKg <= 0) return null

    const collected = Number(codAmount)
    return {
      pickupCityId: pickedCityId,
      pickupZoneId: pickedZoneId,
      deliveryCityId: deliveredCityId,
      deliveryZoneId: deliveredZoneId,
      weightGrams: Math.round(weightKg * 1000),
      codAmount: paymentType === "COD" && Number.isFinite(collected) ? collected : 0,
    }
  }, [pickedCityId, pickedZoneId, deliveredCityId, deliveredZoneId, weight, codAmount, paymentType])

  const quote = useFeeQuote(quoteRequest)

  const cities = useCities()
  const savedAddresses = useSavedAddresses()
  const pickupZones = useCityZones(pickedCityId)
  const pickupAreas = useZoneAreas(pickedZoneId)
  const deliveryZones = useCityZones(deliveredCityId)
  const deliveryAreas = useZoneAreas(deliveredZoneId)

  const cityOptions = cities.data ?? []
  const savedAddressOptions = savedAddresses.data ?? []
  const pickupZoneOptions = pickupZones.data ?? []
  const pickupAreaOptions = pickupAreas.data ?? []
  const deliveryZoneOptions = deliveryZones.data ?? []
  const deliveryAreaOptions = deliveryAreas.data ?? []

  /**
   * Prefill one end's cascade from a saved address. The saved address carries the
   * same city/zone/area ids a booking end does, so this is a straight copy — no
   * translation, and the cascade's own parent-child rules are already satisfied
   * because the address was validated when it was saved. Its map pin, if it has
   * one, comes along; a pin the address never had stays empty rather than
   * inventing a location.
   */
  function applySavedAddress(end: "pickup" | "delivery", addressId: string) {
    const address = savedAddressOptions.find((option) => option.id === addressId)
    if (!address) return
    const prefix = end === "pickup" ? "pickup" : "delivery"
    form.setValue(`${prefix}CityId`, address.cityId, { shouldValidate: false })
    form.setValue(`${prefix}ZoneId`, address.zoneId, { shouldValidate: false })
    form.setValue(`${prefix}AreaId`, address.areaId ?? "", { shouldValidate: false })
    form.setValue(`${prefix}AddressLine`, address.addressLine, { shouldValidate: false })
    form.setValue(`${prefix}Latitude`, address.latitude === null ? "" : String(address.latitude), {
      shouldValidate: false,
    })
    form.setValue(
      `${prefix}Longitude`,
      address.longitude === null ? "" : String(address.longitude),
      { shouldValidate: false },
    )
  }

  /**
   * Booking is impossible until the API can be asked which cities exist — the
   * cascade has nowhere else to get its options from. Zone and area lists
   * follow the picked city, so they are never a gate.
   */
  const referenceDataReady = cityOptions.length > 0

  /** Changing a city orphans its zone and area picks, so clear the cascade. */
  function selectPickupCity(cityId: string) {
    form.setValue("pickupCityId", cityId, { shouldValidate: false })
    form.setValue("pickupZoneId", "", { shouldValidate: false })
    form.setValue("pickupAreaId", "")
  }

  function selectPickupZone(zoneId: string) {
    form.setValue("pickupZoneId", zoneId, { shouldValidate: false })
    form.setValue("pickupAreaId", "")
  }

  function selectDeliveryCity(cityId: string) {
    form.setValue("deliveryCityId", cityId, { shouldValidate: false })
    form.setValue("deliveryZoneId", "", { shouldValidate: false })
    form.setValue("deliveryAreaId", "")
  }

  function selectDeliveryZone(zoneId: string) {
    form.setValue("deliveryZoneId", zoneId, { shouldValidate: false })
    form.setValue("deliveryAreaId", "")
  }

  async function goNext() {
    setServerError(null)
    const valid = await form.trigger(STEP_FIELDS[step - 1], { shouldFocus: true })
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
            Sending to {values.receiverName} ({values.receiverPhone}), at{" "}
            {joinedAddress(
              values,
              "delivery",
              cityOptions,
              deliveryZoneOptions,
              deliveryAreaOptions,
            )}
            .
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
      // The booking exists; the draft must not outlive it. Fire-and-forget —
      // `discard` flips its no-op ref synchronously, so a pending autosave can
      // no longer land even if this request is still in flight during redirect.
      void discardDraft()
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
    <div className="mx-auto grid w-full gap-7">
      {confirmationDialog}
      <PageHeader
        eyebrow="New shipment"
        title="Book a parcel"
        description="A few simple steps to get your parcel on its way."
      />
      {authStatus === "authenticated" && draftStatus !== "idle" ? (
        <p className="text-muted-foreground -mt-4 text-xs" role="status" aria-live="polite">
          {draftStatus === "saving" ? "Saving draft…" : null}
          {draftStatus === "saved" ? "Draft saved" : null}
          {draftStatus === "error" ? "Draft not saved" : null}
        </p>
      ) : null}
      <Form {...form}>
        <form
          onSubmit={(event) => {
            if (step < STEPS.length) {
              event.preventDefault()
              void goNext()
              return
            }
            void form.handleSubmit(onSubmit)(event)
          }}
          className="grid gap-6 [&_[data-slot=input]]:h-12 [&_[data-slot=select-trigger]]:h-12 [&_[data-slot=select-trigger]]:bg-[#FBFBFC] [&_textarea]:bg-[#FBFBFC]"
          noValidate
        >
          <nav aria-label="Booking progress" className="grid gap-3">
            <ol className="grid grid-cols-6 gap-1 sm:gap-3">
              {STEPS.map((item, index) => {
                const number = index + 1
                const active = number === step
                const complete = number < step
                return (
                  <li key={item.title}>
                    <button
                      type="button"
                      className={cn(
                        "focus-visible:outline-primary flex w-full flex-col items-center gap-2 rounded-lg py-2 text-xs font-medium focus-visible:outline-2 sm:flex-row sm:text-sm",
                        active ? "text-accent-ink" : "text-muted-foreground",
                      )}
                      onClick={() => number < step && setStep(number)}
                      disabled={number >= step}
                      aria-current={active ? "step" : undefined}
                      aria-label={`Step ${number}: ${item.title}${index === 3 ? " (optional)" : ""}`}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs",
                          active
                            ? "bg-primary text-primary-foreground"
                            : complete
                              ? "bg-primary/10 text-accent-ink"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {complete ? <CheckIcon className="size-3.5" aria-hidden /> : number}
                      </span>
                      {item.title}
                    </button>
                  </li>
                )
              })}
            </ol>
            <div className="bg-muted h-1 overflow-hidden rounded-full" aria-hidden>
              <div
                className="bg-primary h-full transition-[width] duration-300"
                style={{ width: `${(step / STEPS.length) * 100}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs" aria-live="polite">
              Step {step} of {STEPS.length} · {STEPS[step - 1]?.description}
            </p>
          </nav>

          <div
            className={cn(
              "grid items-start gap-6",
              step !== 2 && "lg:grid-cols-[minmax(0,1.6fr)_minmax(19rem,0.8fr)]",
            )}
          >
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
                  </CardContent>
                </Card>
              ) : null}

              {step === 2 ? (
                <Card className="overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
                  <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-7">
                    <BookingCardTitle icon={MapPinIcon} step="02" title="Addresses" />
                    <CardDescription>
                      Where we collect and where it lands. Drop a pin on each map so the rider gets
                      the exact spot — the pickup and delivery hubs are chosen for you.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid items-start gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-2">
                    <AddressSection
                      form={form}
                      end="pickup"
                      icon={PackageIcon}
                      title="Pickup address"
                      subtitle="Where the rider collects the parcel"
                      savedAddresses={savedAddressOptions}
                      cities={cityOptions}
                      zones={pickupZoneOptions}
                      areas={pickupAreaOptions}
                      onApplySaved={(id) => applySavedAddress("pickup", id)}
                      onSelectCity={selectPickupCity}
                      onSelectZone={selectPickupZone}
                    />

                    <AddressSection
                      form={form}
                      end="delivery"
                      icon={MapPinIcon}
                      title="Delivery address"
                      subtitle="Tell the rider exactly where to go"
                      savedAddresses={savedAddressOptions}
                      cities={cityOptions}
                      zones={deliveryZoneOptions}
                      areas={deliveryAreaOptions}
                      onApplySaved={(id) => applySavedAddress("delivery", id)}
                      onSelectCity={selectDeliveryCity}
                      onSelectZone={selectDeliveryZone}
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

              {step === 5 ? (
                <Card className="overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
                  <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-7">
                    <BookingCardTitle icon={WalletCardsIcon} step="05" title="Payment" />
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
                    <BookingCardTitle icon={PackageIcon} step="04" title="What’s in your parcel?" />
                    <CardDescription>
                      Add the items you’re sending, or skip this step. Item prices do not set the
                      cash collection amount.
                    </CardDescription>
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
                        className="border-border grid gap-5 border-b pb-6 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Item {index + 1}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove item ${index + 1}`}
                            onClick={() => items.remove(index)}
                          >
                            <Trash2Icon aria-hidden />
                            Remove
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                          <FormField
                            control={form.control}
                            name={`items.${index}.name`}
                            render={({ field }) => (
                              <FormItem className="col-span-2 sm:col-span-1">
                                <FormLabel>Item name</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="e.g. Cotton shirt" />
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
                                  <Input
                                    {...field}
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={9999}
                                    step={1}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price each (BDT)</FormLabel>
                                <FormControl>
                                  <Input {...field} inputMode="decimal" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <details
                          open={
                            form.formState.errors.items?.[index]?.description ? true : undefined
                          }
                          className="group"
                        >
                          <summary className="text-muted-foreground focus-visible:outline-primary cursor-pointer text-sm focus-visible:outline-2">
                            Add a description <span className="text-xs">(optional)</span>
                          </summary>
                          <FormField
                            control={form.control}
                            name={`items.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    rows={2}
                                    placeholder="Colour, size or other useful details"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </details>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-fit"
                      onClick={() => items.append({ ...EMPTY_ITEM })}
                      disabled={items.fields.length >= 50}
                    >
                      <PlusIcon aria-hidden />
                      {items.fields.length === 0 ? "Add an item" : "Add another item"}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {step === 6 ? (
                <ReviewCard
                  values={form.getValues()}
                  pickupAddress={joinedAddress(
                    form.getValues(),
                    "pickup",
                    cityOptions,
                    pickupZoneOptions,
                    pickupAreaOptions,
                  )}
                  deliveryAddress={joinedAddress(
                    form.getValues(),
                    "delivery",
                    cityOptions,
                    deliveryZoneOptions,
                    deliveryAreaOptions,
                  )}
                  quote={quote.data}
                />
              ) : null}
              {serverError ? (
                <Alert variant="destructive">
                  <TriangleAlertIcon aria-hidden />
                  <AlertTitle>We could not book that parcel</AlertTitle>
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="border-border flex items-center justify-between gap-3 border-t pt-5">
                {step > 1 ? (
                  <Button type="button" variant="ghost" onClick={goBack} className="shrink-0">
                    <ArrowLeftIcon aria-hidden />
                    Back
                  </Button>
                ) : null}
                {step < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={() => void goNext()}
                    className="ml-auto"
                    disabled={step > 1 && !referenceDataReady}
                  >
                    {step === 4 && items.fields.length === 0
                      ? "Skip items"
                      : step === 5
                        ? "Review booking"
                        : "Continue"}
                    <ArrowRightIcon aria-hidden />
                  </Button>
                ) : (
                  <LoadingButton
                    type="submit"
                    loading={createParcel.isPending}
                    disabled={!referenceDataReady}
                    className="ml-auto"
                  >
                    {createParcel.isPending ? "Booking…" : "Confirm and book"}
                    <CheckIcon aria-hidden />
                  </LoadingButton>
                )}
              </div>

              {!referenceDataReady ? (
                <p className="text-muted-foreground text-xs">
                  Booking is disabled until the city list is available.
                </p>
              ) : null}
            </div>

            {step !== 2 ? (
              <aside className="grid h-fit gap-4 lg:sticky lg:top-6" aria-label="Booking summary">
                <Card className="border-border bg-muted/30 overflow-hidden py-0 shadow-none">
                  <CardHeader className="relative gap-1 px-5 pt-6 pb-4">
                    <CardTitle className="text-lg">Delivery estimate</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Based on your addresses and parcel weight.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative grid gap-4 px-5 pb-6">
                    {!quoteRequest ? (
                      <div className="border-border bg-muted rounded-xl border p-4">
                        <p className="text-foreground text-sm font-medium">
                          Waiting for addresses and weight
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs leading-5">
                          Complete the address and parcel steps to calculate the fee.
                        </p>
                      </div>
                    ) : quote.isPending ? (
                      <div className="grid gap-2" aria-busy="true">
                        <Skeleton className="bg-border h-4 w-full" />
                        <Skeleton className="bg-border h-4 w-2/3" />
                        <Skeleton className="bg-border h-12 w-full" />
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
                          label="Base fee"
                          value={formatMoney(quote.data.baseFee, quote.data.currency)}
                        />
                        {quote.data.extraWeightFee > 0 ? (
                          <QuoteRow
                            label="Extra weight fee"
                            value={formatMoney(quote.data.extraWeightFee, quote.data.currency)}
                          />
                        ) : null}
                        {quote.data.codFee > 0 ? (
                          <QuoteRow
                            label="Cash on delivery fee"
                            value={formatMoney(quote.data.codFee, quote.data.currency)}
                          />
                        ) : null}
                        <Separator className="bg-border" />
                        <div className="flex items-end justify-between gap-4 pt-1">
                          <dt className="text-muted-foreground text-sm font-medium">
                            Estimated total
                          </dt>
                          <dd className="text-foreground text-2xl font-extrabold tracking-[-0.04em] tabular-nums">
                            {formatMoney(quote.data.total, quote.data.currency)}
                          </dd>
                        </div>
                      </dl>
                    )}

                    <div className="border-border text-muted-foreground flex items-start gap-2 border-t pt-4 text-xs leading-5">
                      <ShieldCheckIcon
                        className="mt-0.5 size-4 shrink-0 text-[#FF8A4C]"
                        aria-hidden
                      />
                      <p>You’ll review the delivery fee before confirming your booking.</p>
                    </div>
                  </CardContent>
                </Card>
              </aside>
            ) : null}
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
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground font-medium tabular-nums">{value}</dd>
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
  pickupAddress,
  deliveryAddress,
  quote,
}: {
  values: BookParcelValues
  pickupAddress: string
  deliveryAddress: string
  quote: FeeQuote | undefined
}) {
  return (
    <Card className="overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
      <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-7">
        <BookingCardTitle icon={ClipboardCheckIcon} step="06" title="Review your booking" />
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
          </ReviewGroup>
          <ReviewGroup title="Addresses" icon={MapPinIcon}>
            <ReviewRow label="Pickup" value={pickupAddress} />
            <ReviewRow label="Delivery" value={deliveryAddress} />
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

/** Both pins stored as text, so "no pin yet" is an empty string, not a zero. */
function toMapPoint(latitude: string, longitude: string): MapPoint | null {
  if (latitude === "" || longitude === "") return null
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { latitude: lat, longitude: lng }
}

/**
 * One end of a booking: the saved-address shortcut, the city/zone/area cascade,
 * the free-text line, and the map pin. The two ends differ only in prefix, icon
 * and copy — everything else is the same control — so both render through this,
 * with the prefix driving the form's own `pickup*`/`delivery*` field names.
 *
 * The pin is a pair of form fields rather than one object so it survives the
 * schema's string-only contract: the map writes, zod checks the range, and
 * `toCreateRequest` converts to the numbers the API takes.
 */
function AddressSection({
  form,
  end,
  icon: Icon,
  title,
  subtitle,
  savedAddresses,
  cities,
  zones,
  areas,
  onApplySaved,
  onSelectCity,
  onSelectZone,
}: {
  form: UseFormReturn<BookParcelValues>
  end: "pickup" | "delivery"
  icon: LucideIcon
  title: string
  subtitle: string
  savedAddresses: CustomerAddress[]
  cities: ReferenceOption[]
  zones: ReferenceOption[]
  areas: ReferenceOption[]
  onApplySaved: (addressId: string) => void
  onSelectCity: (cityId: string) => void
  onSelectZone: (zoneId: string) => void
}) {
  const { control } = form
  const cityId = useWatch({ control, name: `${end}CityId` })
  const zoneId = useWatch({ control, name: `${end}ZoneId` })
  const addressLine = useWatch({ control, name: `${end}AddressLine` })
  const latitude = useWatch({ control, name: `${end}Latitude` })
  const longitude = useWatch({ control, name: `${end}Longitude` })

  return (
    <div className="rounded-2xl bg-[#F6F8FB] p-4 sm:p-5">
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FFF0EB] text-[#E64D00]">
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#1A1D24]">{title}</p>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
      </div>

      {savedAddresses.length > 0 ? (
        <div className="mb-5">
          <Select
            value=""
            onValueChange={(value) => {
              if (value) onApplySaved(value)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Use a saved address" />
            </SelectTrigger>
            <SelectContent>
              {savedAddresses.map((address) => (
                <SelectItem key={address.id} value={address.id}>
                  <span className="grid gap-0.5">
                    <span>{address.label || address.addressLine}</span>
                    <span className="text-muted-foreground text-xs">
                      {[address.areaName, address.zoneName, address.cityName]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={control}
            name={`${end}CityId`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <ReferenceSelect
                  value={field.value}
                  onValueChange={onSelectCity}
                  options={cities}
                  source="cities"
                  placeholder={`Pick the ${end} city`}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`${end}ZoneId`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zone</FormLabel>
                <ReferenceSelect
                  value={field.value}
                  onValueChange={onSelectZone}
                  options={zones}
                  source="city-zones"
                  loading={!cityId}
                  placeholder="Pick the zone under that city"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name={`${end}AreaId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Area <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <ReferenceSelect
                value={field.value}
                onValueChange={field.onChange}
                options={areas}
                source="zone-areas"
                loading={!zoneId}
                placeholder="Pick an area, if listed"
                emptyTitle="No areas in this zone yet"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${end}AddressLine`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address line</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  placeholder="House / Building / Flat number, road and landmark"
                  className="bg-white"
                  autoComplete="street-address"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <MapAddressPicker
          value={toMapPoint(latitude, longitude)}
          onChange={(point) => {
            form.setValue(`${end}Latitude`, point ? String(point.latitude) : "", {
              shouldValidate: false,
            })
            form.setValue(`${end}Longitude`, point ? String(point.longitude) : "", {
              shouldValidate: false,
            })
          }}
          onSuggestAddress={(line) => {
            if (!addressLine.trim()) {
              form.setValue(`${end}AddressLine`, line, { shouldValidate: true })
            }
          }}
        />
      </div>
    </div>
  )
}
