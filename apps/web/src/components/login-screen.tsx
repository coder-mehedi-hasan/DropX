"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  DropXLogo,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LoadingButton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@dropx/ui"
import { ArrowLeftIcon, MessageSquareIcon, TriangleAlertIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { authApi } from "@/lib/api"
import { isApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import type { OtpRequestResult } from "@/lib/types"

/**
 * Two-step OTP.
 *
 * The rules mirror `otpIdentifier` in `apps/api`'s `auth.dto.ts` so the customer
 * is told about a typo before a request is made. Consent is a literal `true` in
 * the payload because the API creates a TEMP `customers` row on the first
 * request — there is no later moment to accept the terms.
 */

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(255)

const phone = z
  .string()
  .trim()
  .min(10, "Enter a valid phone number")
  .max(30)
  .regex(/^\+?[0-9\s-]+$/, "Enter a valid phone number")

const identifierSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Enter your phone number or email")
    .max(255)
    .refine(
      (value) =>
        value.includes("@") ? email.safeParse(value).success : phone.safeParse(value).success,
      {
        message: "Enter a valid phone number or email address",
      },
    ),
  /**
   * Typed as a plain `boolean` rather than `z.literal(true)`: the checkbox owns
   * a boolean, and a literal type would make the field untypeable at the input.
   * The refinement is what actually enforces consent.
   */
  consent: z.boolean().refine((accepted) => accepted, {
    message: "You must accept the terms to continue",
  }),
})

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
})

type IdentifierValues = z.infer<typeof identifierSchema>
type CodeValues = z.infer<typeof codeSchema>

/** Only same-origin paths, so `?next=` cannot be used as an open redirect. */
function safePath(candidate: string | undefined): string {
  if (!candidate) return "/dashboard"
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/dashboard"
  return candidate
}

export function LoginScreen({ requestedPath }: { requestedPath?: string }) {
  const router = useRouter()
  const { status, signIn } = useAuth()

  const [challenge, setChallenge] = React.useState<OtpRequestResult | null>(null)
  const [identifier, setIdentifier] = React.useState("")
  const [secondsLeft, setSecondsLeft] = React.useState(0)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  const [verifying, setVerifying] = React.useState(false)

  const destination = safePath(requestedPath)

  React.useEffect(() => {
    if (status === "authenticated") router.replace(destination)
  }, [status, router, destination])

  /**
   * The countdown is the code's own lifetime, so the resend button unlocks
   * exactly when the current code stops working.
   */
  React.useEffect(() => {
    if (secondsLeft <= 0) return

    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => Math.max(0, previous - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [secondsLeft])

  async function startChallenge(values: IdentifierValues, isResend: boolean) {
    setSending(true)
    setFormError(null)

    try {
      const result = await authApi.requestOtp(values.identifier)
      /**
       * Captured from the submitted values, never mirrored from the input. The
       * identifier step remounts when a challenge exists — a live mirror is
       * reset to `""` by that remount, and the code step then verifies against
       * the empty string.
       */
      setIdentifier(values.identifier.trim())
      setChallenge(result)
      setSecondsLeft(result.expiresInSeconds)
      if (isResend) toast.success("A new code is on its way")
    } catch (error) {
      setFormError(
        isApiError(error) ? error.message : "We could not send a code. Please try again.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(34rem,0.95fr)]">
      <section
        className="relative hidden min-h-screen overflow-hidden bg-cover bg-center lg:block"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=85)",
        }}
        aria-label="A DropX team planning parcel deliveries"
      >
        <div className="absolute inset-0 bg-slate-950/25" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-14">
          <DropXLogo size="lg" className="text-white" />
          <div className="max-w-sm">
            <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-white/75 uppercase">
              Parcel delivery, simplified
            </p>
            <h1 className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
              Send it anywhere. Follow it everywhere.
            </h1>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-white px-6 py-12 sm:px-12 lg:px-20">
        <div className="w-full max-w-md">
          <div className="mb-14">
            <DropXLogo size="lg" />
          </div>
          <Tabs value={challenge ? "code" : "identifier"} className="gap-4">
            <TabsList className="sr-only">
              <TabsTrigger value="identifier" className="text-xs">
                1 · Your number
              </TabsTrigger>
              <TabsTrigger value="code" className="text-xs" disabled={!challenge}>
                2 · Your code
              </TabsTrigger>
            </TabsList>

            {formError ? (
              <Alert variant="destructive">
                <TriangleAlertIcon aria-hidden />
                <AlertTitle>We could not continue</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <IdentifierStep
              // Remounts on a new challenge so the field clears for a different
              // identifier; consent stays ticked because it was already given.
              key={challenge ? challenge.destination : "blank"}
              onSubmit={(values) => void startChallenge(values, false)}
              busy={sending}
              initialConsent={challenge !== null}
            />

            {challenge ? (
              <CodeStep
                challenge={challenge}
                secondsLeft={secondsLeft}
                verifying={verifying}
                onResend={() => void startChallenge({ identifier, consent: true }, true)}
                onBack={() => {
                  setChallenge(null)
                  setSecondsLeft(0)
                  setFormError(null)
                }}
                onVerify={async (code) => {
                  setVerifying(true)
                  setFormError(null)

                  try {
                    const session = await authApi.verifyOtp(identifier, code)
                    signIn(session)
                    toast.success(`Welcome back, ${session.customer.name || "friend"}`)
                    router.replace(destination)
                  } catch (error) {
                    setFormError(
                      isApiError(error)
                        ? error.message
                        : "We could not verify that code. Please try again.",
                    )
                  } finally {
                    setVerifying(false)
                  }
                }}
              />
            ) : null}
          </Tabs>
          <p className="text-muted-foreground mt-12 text-center text-sm">
            <a href="/track" className="hover:text-foreground underline underline-offset-4">
              Track a parcel without signing in
            </a>
          </p>
        </div>
      </section>
    </div>
  )
}

function IdentifierStep({
  onSubmit,
  busy,
  initialConsent,
}: {
  onSubmit: (values: IdentifierValues) => void
  busy: boolean
  initialConsent: boolean
}) {
  const form = useForm<IdentifierValues>({
    resolver: zodResolver(identifierSchema),
    defaultValues: { identifier: "", consent: initialConsent },
    mode: "onSubmit",
  })

  return (
    <TabsContent value="identifier" className="gap-0">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in to DropX</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm leading-6">
          We&apos;ll send a one-time code to your phone or email.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6" noValidate>
          <FormField
            control={form.control}
            name="identifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Phone number or email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="01712345678 or you@example.com"
                    className="h-12 rounded-lg"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="consent"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <FormLabel className="items-start text-sm leading-5 font-normal">
                    I agree to DropX using my contact details to deliver and update me about
                    parcels.
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <LoadingButton type="submit" loading={busy} className="h-12 w-full rounded-lg">
            <MessageSquareIcon aria-hidden />
            {busy ? "Sending…" : "Send my code"}
          </LoadingButton>
        </form>
      </Form>
    </TabsContent>
  )
}

function CodeStep({
  challenge,
  secondsLeft,
  verifying,
  onVerify,
  onResend,
  onBack,
}: {
  challenge: OtpRequestResult
  secondsLeft: number
  verifying: boolean
  onVerify: (code: string) => Promise<void>
  onResend: () => void
  onBack: () => void
}) {
  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
    mode: "onSubmit",
  })
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([])

  const canResend = secondsLeft <= 0

  React.useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  return (
    <TabsContent value="code" className="gap-0">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Enter OTP</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm leading-6">
          We have sent a code to <span className="font-medium">{challenge.destination}</span>
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => void onVerify(values.code))}
          className="grid gap-7"
          noValidate
        >
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Six-digit code</FormLabel>
                <FormControl>
                  <div
                    className="flex justify-center gap-3 sm:gap-3.5"
                    role="group"
                    aria-label="Six-digit verification code"
                  >
                    {Array.from({ length: 6 }, (_, index) => (
                      <Input
                        key={index}
                        ref={(element) => {
                          inputRefs.current[index] = element
                        }}
                        value={field.value[index] ?? ""}
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        aria-label={`Digit ${index + 1} of 6`}
                        className="size-12 rounded-lg border-slate-300 p-0 text-center font-mono text-xl font-semibold sm:size-13"
                        onChange={(event) => {
                          const digit = event.target.value.replace(/\D/g, "").slice(-1)
                          const nextCode = field.value.split("")
                          nextCode[index] = digit
                          field.onChange(nextCode.join("").slice(0, 6))
                          if (digit && index < 5) inputRefs.current[index + 1]?.focus()
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Backspace" && !field.value[index] && index > 0) {
                            inputRefs.current[index - 1]?.focus()
                          }
                        }}
                        onPaste={(event) => {
                          event.preventDefault()
                          const pasted = event.clipboardData
                            .getData("text")
                            .replace(/\D/g, "")
                            .slice(0, 6)
                          if (!pasted) return
                          field.onChange(pasted)
                          inputRefs.current[Math.min(pasted.length, 6) - 1]?.focus()
                        }}
                      />
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <LoadingButton type="submit" loading={verifying} className="h-12 w-full rounded-lg">
            {verifying ? "Verifying…" : "Verify and sign in"}
          </LoadingButton>
        </form>
      </Form>

      <div className="mt-8 flex flex-col items-center gap-3 text-sm">
        <p className="text-muted-foreground">
          Didn&apos;t receive code?{" "}
          <button
            type="button"
            className="text-primary font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onResend}
            disabled={!canResend || verifying}
          >
            {canResend ? "Resend OTP" : `Resend in ${secondsLeft}s`}
          </button>
        </p>
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          <ArrowLeftIcon aria-hidden /> Use a different number
        </Button>
      </div>
    </TabsContent>
  )
}
