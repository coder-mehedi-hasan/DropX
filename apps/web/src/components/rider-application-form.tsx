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
import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react"
import * as React from "react"
import { useForm } from "react-hook-form"
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

export function RiderApplicationForm() {
  const [submitted, setSubmitted] = React.useState(false)
  const [serverError, setServerError] = React.useState<unknown>(null)
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
          <Button variant="outline" className="mx-auto" onClick={() => setSubmitted(false)}>
            Submit another application
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6" noValidate>
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
          <FormInput<Values> name="licenseNumber" label="License number" placeholder="Optional" />
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
          label="Additional details"
          placeholder="Tell us anything useful about your experience or preferred area."
          rows={4}
        />
        <FormCheckbox<Values>
          name="consent"
          label="I agree that DropX may contact me about this rider application."
          required
        />
        <LoadingButton
          type="submit"
          size="lg"
          loading={form.formState.isSubmitting}
          className="w-full sm:w-fit"
        >
          Send application
        </LoadingButton>
        <p className="text-muted-foreground text-xs">
          We only use these details to review your application and contact you about rider
          opportunities.
        </p>
      </form>
    </Form>
  )
}
