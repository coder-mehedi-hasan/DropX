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
  Checkbox,
  Form,
  FormControl,
  FormDescription,
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
import { KeyRoundIcon, MailCheckIcon, MessageSquareIcon, TriangleAlertIcon } from "lucide-react"
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
    <Card className="w-full gap-0 py-0 shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-lg">Sign in to DropX</CardTitle>
        <CardDescription>
          We send a six-digit code to your phone or email. There is no password to remember.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <Tabs value={challenge ? "code" : "identifier"} className="gap-4">
          <TabsList className="w-full">
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
              identifier={identifier}
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
      </CardContent>
    </Card>
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
    <TabsContent value="identifier">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <FormField
            control={form.control}
            name="identifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number or email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="01712345678 or you@example.com"
                  />
                </FormControl>
                <FormDescription>
                  We match the channel to what you enter — no account needed first.
                </FormDescription>
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
                  <FormLabel className="items-start leading-snug font-normal">
                    I agree to DropX storing my phone number and email to deliver my parcels, and to
                    be contacted about them.
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <LoadingButton type="submit" loading={busy} className="w-full">
            <MessageSquareIcon aria-hidden />
            {busy ? "Sending…" : "Send my code"}
          </LoadingButton>
        </form>
      </Form>
    </TabsContent>
  )
}

function CodeStep({
  identifier,
  challenge,
  secondsLeft,
  verifying,
  onVerify,
  onResend,
  onBack,
}: {
  identifier: string
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

  const canResend = secondsLeft <= 0

  return (
    <TabsContent value="code" className="gap-4">
      <Alert variant={challenge.isNewCustomer ? "default" : "success"}>
        {challenge.channel === "EMAIL" ? (
          <MailCheckIcon aria-hidden />
        ) : (
          <KeyRoundIcon aria-hidden />
        )}
        <AlertTitle>
          {challenge.channel === "EMAIL" ? "Check your email" : "Check your messages"}
        </AlertTitle>
        <AlertDescription>
          <p>
            A six-digit code is on its way to{" "}
            <span className="font-medium">{challenge.destination}</span>.{" "}
            {challenge.isNewCustomer
              ? "This is your first sign-in — verifying the code will create your account."
              : "Sign in with the code we just sent."}
          </p>
          <p className="text-xs">The code expires in {formatCountdown(secondsLeft)}.</p>
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => void onVerify(values.code))}
          className="grid gap-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Six-digit code</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    className="text-foreground text-center font-mono text-lg font-bold tracking-[0.5em]"
                    onChange={(event) =>
                      field.onChange(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <LoadingButton type="submit" loading={verifying} className="w-full">
            {verifying ? "Verifying…" : "Verify and sign in"}
          </LoadingButton>
        </form>
      </Form>

      <div className="flex items-center justify-between text-sm">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Use a different number
        </Button>
        <Button variant="outline" size="sm" onClick={onResend} disabled={!canResend || verifying}>
          {canResend ? "Resend code" : `Resend in ${secondsLeft}s`}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Requested for <span className="font-medium">{identifier}</span>. A code can be tried five
        times before it is invalidated.
      </p>
    </TabsContent>
  )
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`
}
