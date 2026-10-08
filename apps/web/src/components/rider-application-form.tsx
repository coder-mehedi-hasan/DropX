"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Form,
  FormCheckbox,
  FormInput,
  FormSelect,
  FormTextarea,
  LoadingButton,
  ServerFormError,
} from "@dropx/ui"
import {
  BikeIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockKeyholeIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react"
import * as React from "react"
import { type FieldErrors, type FieldPath, useForm } from "react-hook-form"
import { z } from "zod"

import { riderApplicationsApi, type RiderApplicationPayload } from "@/lib/api"
import { isApiError } from "@/lib/api-client"

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(150),
  phone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .max(30)
    .regex(/^\+?[0-9\s-]+$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email address").max(255).or(z.literal("")),
  district: z.string().trim().min(2, "Enter your district").max(100),
  vehicleType: z.enum(["BICYCLE", "MOTORCYCLE", "CAR", "VAN", "OTHER"]),
  licenseNumber: z.string().trim().max(100).or(z.literal("")),
  experienceYears: z
    .string()
    .refine(
      (value) => value === "" || (Number(value) >= 0 && Number(value) <= 60),
      "Enter a number from 0 to 60",
    )
    .optional(),
  availability: z.string().trim().min(2, "Tell us when you are available").max(100),
  notes: z.string().trim().max(1000).or(z.literal("")),
  consent: z.boolean().refine(Boolean, "You must agree to be contacted by DropX"),
})

type Values = z.infer<typeof schema>

const CONTACT_FIELDS = ["name", "phone", "email", "district"] satisfies FieldPath<Values>[]
const RIDING_FIELDS = [
  "vehicleType",
  "licenseNumber",
  "experienceYears",
  "availability",
  "notes",
] satisfies FieldPath<Values>[]

const FORM_STEPS = [
  { title: "Contact", description: "Your details" },
  { title: "Riding", description: "Your setup" },
  { title: "Review", description: "Confirm and send" },
] as const

const VEHICLE_LABELS: Record<Values["vehicleType"], string> = {
  BICYCLE: "Bicycle",
  MOTORCYCLE: "Motorcycle",
  CAR: "Car",
  VAN: "Van",
  OTHER: "Other",
}

export function RiderApplicationForm() {
  const [submitted, setSubmitted] = React.useState(false)
  const [serverError, setServerError] = React.useState<unknown>(null)
  const [step, setStep] = React.useState(0)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      district: "",
      vehicleType: "MOTORCYCLE",
      licenseNumber: "",
      experienceYears: "",
      availability: "",
      notes: "",
      consent: false,
    },
  })

  async function onSubmit(values: Values) {
    setServerError(null)
    try {
      const payload: RiderApplicationPayload = {
        ...values,
        email: values.email || undefined,
        licenseNumber: values.licenseNumber || undefined,
        experienceYears: values.experienceYears ? Number(values.experienceYears) : undefined,
        notes: values.notes || undefined,
        consent: true,
      }
      await riderApplicationsApi.submit(payload)
      setSubmitted(true)
    } catch (error) {
      setServerError(error)
    }
  }

  async function advance(fields: FieldPath<Values>[]) {
    const valid = await form.trigger(fields, { shouldFocus: true })
    if (valid) setStep((current) => Math.min(current + 1, FORM_STEPS.length - 1))
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (step === 0) {
      event.preventDefault()
      void advance(CONTACT_FIELDS)
      return
    }

    if (step === 1) {
      event.preventDefault()
      void advance(RIDING_FIELDS)
      return
    }

    void form.handleSubmit(onSubmit, handleInvalid)(event)
  }

  function handleInvalid(errors: FieldErrors<Values>) {
    if (CONTACT_FIELDS.some((field) => errors[field])) {
      setStep(0)
      return
    }
    if (RIDING_FIELDS.some((field) => errors[field])) setStep(1)
  }

  function startAnotherApplication() {
    form.reset()
    setServerError(null)
    setStep(0)
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="grid gap-4 p-8 text-center sm:p-12">
          <CheckCircle2Icon className="text-primary mx-auto size-12" aria-hidden />
          <h2 className="text-2xl font-bold">Application received</h2>
          <p className="text-muted-foreground mx-auto max-w-md">
            Thanks for your interest in riding with DropX. Our team will review your details and
            contact you soon.
          </p>
          <Button variant="outline" className="mx-auto" onClick={startAnotherApplication}>
            Submit another application
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmit} className="grid gap-8" noValidate>
        <FormProgress step={step} onStepChange={setStep} />

        <ServerFormError
          error={serverError}
          title="We could not send your application"
          onDismiss={() => setServerError(null)}
        />
        {serverError && !isApiError(serverError) ? (
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>Try again</AlertTitle>
            <AlertDescription>Check your connection and submit once more.</AlertDescription>
          </Alert>
        ) : null}

        {step === 0 ? (
          <FormSection
            icon={UserRoundIcon}
            title="Contact details"
            description="How our team can reach you and where you plan to ride."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput<Values> name="name" label="Full name" placeholder="Your name" required />
              <FormInput<Values>
                name="phone"
                label="Phone number"
                placeholder="01XXXXXXXXX"
                required
                type="tel"
              />
              <FormInput<Values>
                name="email"
                label="Email address"
                placeholder="you@example.com"
                type="email"
              />
              <FormInput<Values>
                name="district"
                label="District"
                placeholder="Where do you ride?"
                required
              />
            </div>
          </FormSection>
        ) : null}

        {step === 1 ? (
          <FormSection
            icon={BikeIcon}
            title="Riding setup"
            description="Your vehicle, experience, and usual availability."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelect<Values>
                name="vehicleType"
                label="Vehicle type"
                required
                options={[
                  { value: "BICYCLE", label: "Bicycle" },
                  { value: "MOTORCYCLE", label: "Motorcycle" },
                  { value: "CAR", label: "Car" },
                  { value: "VAN", label: "Van" },
                  { value: "OTHER", label: "Other" },
                ]}
              />
              <FormInput<Values>
                name="licenseNumber"
                label="License number"
                placeholder="Optional"
              />
              <FormInput<Values>
                name="experienceYears"
                label="Delivery experience (years)"
                type="number"
                min={0}
                step={0.5}
                placeholder="0"
              />
              <FormInput<Values>
                name="availability"
                label="Availability"
                placeholder="e.g. Weekdays, 9am–6pm"
                required
              />
            </div>
            <FormTextarea<Values>
              name="notes"
              label="Anything else we should know?"
              description="Optional — share your preferred area or relevant delivery experience."
              placeholder="Add a short note"
              rows={4}
            />
          </FormSection>
        ) : null}

        {step === 2 ? (
          <ReviewStep values={form.getValues()} onEdit={setStep}>
            <div className="rounded-xl bg-[#F7F8FA] p-4 ring-1 ring-black/5">
              <FormCheckbox<Values>
                name="consent"
                label="I agree that DropX may contact me about this rider application."
                required
              />
            </div>
          </ReviewStep>
        ) : null}

        <div className="grid gap-4 border-t border-black/6 pt-6">
          <div className="flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)}>
                <ChevronLeftIcon aria-hidden />
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < FORM_STEPS.length - 1 ? (
              <Button type="submit" size="lg" className="px-7">
                Continue
                <ChevronRightIcon aria-hidden />
              </Button>
            ) : (
              <LoadingButton
                type="submit"
                size="lg"
                loading={form.formState.isSubmitting}
                className="px-7"
              >
                Send application
              </LoadingButton>
            )}
          </div>
          <p className="text-muted-foreground flex items-start gap-2 text-xs leading-5">
            <LockKeyholeIcon className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            We only use these details to review your application and contact you about rider
            opportunities.
          </p>
        </div>
      </form>
    </Form>
  )
}

function FormProgress({
  step,
  onStepChange,
}: {
  step: number
  onStepChange: (step: number) => void
}) {
  return (
    <nav aria-label="Application progress">
      <ol className="grid grid-cols-3 gap-2">
        {FORM_STEPS.map((item, index) => {
          const complete = index < step
          const current = index === step
          return (
            <li key={item.title}>
              <button
                type="button"
                onClick={() => onStepChange(index)}
                disabled={index > step}
                aria-current={current ? "step" : undefined}
                className="group grid w-full gap-2 text-left disabled:cursor-default"
              >
                <span className="flex items-center">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      complete
                        ? "bg-[#0D0F12] text-white"
                        : current
                          ? "bg-[#FF5500] text-white"
                          : "bg-[#ECEFF3] text-[#667085]"
                    }`}
                  >
                    {complete ? <CheckIcon className="size-3.5" aria-hidden /> : index + 1}
                  </span>
                  {index < FORM_STEPS.length - 1 ? (
                    <span
                      className={`h-px flex-1 ${complete ? "bg-[#0D0F12]" : "bg-black/10"}`}
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span>
                  <span
                    className={`block text-xs font-semibold ${current ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {item.title}
                  </span>
                  <span className="text-muted-foreground hidden text-[11px] sm:block">
                    {item.description}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function ReviewStep({
  values,
  onEdit,
  children,
}: {
  values: Values
  onEdit: (step: number) => void
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-5">
      <div>
        <p className="text-accent-ink text-xs font-semibold tracking-[0.12em] uppercase">
          Final check
        </p>
        <h3 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Review your application</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          Make sure these details are correct before you send them.
        </p>
      </div>

      <ReviewGroup title="Contact" onEdit={() => onEdit(0)}>
        <ReviewItem label="Name" value={values.name} />
        <ReviewItem label="Phone" value={values.phone} />
        <ReviewItem label="Email" value={values.email || "Not provided"} />
        <ReviewItem label="District" value={values.district} />
      </ReviewGroup>

      <ReviewGroup title="Riding setup" onEdit={() => onEdit(1)}>
        <ReviewItem label="Vehicle" value={VEHICLE_LABELS[values.vehicleType]} />
        <ReviewItem label="License" value={values.licenseNumber || "Not provided"} />
        <ReviewItem
          label="Experience"
          value={values.experienceYears ? `${values.experienceYears} years` : "Not provided"}
        />
        <ReviewItem label="Availability" value={values.availability} />
        {values.notes ? <ReviewItem label="Additional details" value={values.notes} wide /> : null}
      </ReviewGroup>

      {children}
    </section>
  )
}

function ReviewGroup({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-[#F7F8FA] p-4 ring-1 ring-black/5 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h4 className="font-semibold">{title}</h4>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
    </div>
  )
}

function ReviewItem({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-sm leading-5 font-medium break-words">{value}</dd>
    </div>
  )
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<React.ComponentProps<"svg">>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-5">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4.5" strokeWidth={1.75} aria-hidden />
        </span>
        <div>
          <h3 className="font-semibold tracking-[-0.01em]">{title}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs leading-5">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
