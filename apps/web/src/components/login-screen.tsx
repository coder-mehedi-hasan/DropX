"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DropXLogo,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormCheckbox,
  FormInput,
  FormOtpInput,
  LoadingButton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@dropx/ui"
import {
  ArrowLeftIcon,
  BanknoteIcon,
  MessageSquareIcon,
  PackageCheckIcon,
  RouteIcon,
  TriangleAlertIcon,
} from "lucide-react"
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
 * the payload; account creation is separately confirmed after the API reports
 * that the identifier is not registered.
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
  const [signupPromptOpen, setSignupPromptOpen] = React.useState(false)
  const [pendingSignupIdentifier, setPendingSignupIdentifier] = React.useState<string | null>(null)

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

  async function startChallenge(
    values: IdentifierValues,
    isResend: boolean,
    acceptSignup = false,
  ) {
    setSending(true)
    setFormError(null)

    try {
      const result = await authApi.requestOtp(values.identifier, acceptSignup)
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
      if (isApiError(error) && error.code === "UNREGISTERED_USER" && !acceptSignup) {
        setPendingSignupIdentifier(values.identifier.trim())
        setSignupPromptOpen(true)
        return
      }
      setFormError(
        isApiError(error) ? error.message : "We could not send a code. Please try again.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(34rem,0.95fr)]">
      <BrandPanel />

      <section className="bg-card flex min-h-screen items-center justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="w-full max-w-md">
          <div className="mb-12 lg:hidden">
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
          <Dialog
            open={signupPromptOpen}
            onOpenChange={(open) => {
              setSignupPromptOpen(open)
              if (!open) setPendingSignupIdentifier(null)
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a DropX account?</DialogTitle>
                <DialogDescription>
                  We couldn&apos;t find an account for this contact. Create one and continue with
                  OTP verification?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSignupPromptOpen(false)
                    setPendingSignupIdentifier(null)
                  }}
                >
                  Cancel
                </Button>
                <LoadingButton
                  loading={sending}
                  onClick={() => {
                    if (!pendingSignupIdentifier) return
                    setSignupPromptOpen(false)
                    void startChallenge(
                      { identifier: pendingSignupIdentifier, consent: true },
                      false,
                      true,
                    )
                  }}
                >
                  Create account
                </LoadingButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <p className="text-muted-foreground mt-12 text-center text-sm">
            <a href="/track" className="font-medium">
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
          <FormInput<IdentifierValues>
            name="identifier"
            label="Phone number or email"
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="01712345678 or you@example.com"
            className="h-12 rounded-lg"
          />

          <FormCheckbox<IdentifierValues>
            name="consent"
            label="I agree to DropX using my contact details to deliver and update me about parcels."
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
  const canResend = secondsLeft <= 0

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
          <FormOtpInput<CodeValues> name="code" className="flex justify-center gap-3 sm:gap-3.5" />

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
            className="text-accent-ink hover:text-accent-ink-hover font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-50"
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

const PROMISES = [
  { icon: PackageCheckIcon, text: "Fee quoted before you book" },
  { icon: RouteIcon, text: "Every hub handover tracked" },
  { icon: BanknoteIcon, text: "Prepaid or cash on delivery" },
] as const

/**
 * The sign-in brand panel: Obsidian canvas, a hub-to-hub route drawn in the
 * brand's outline-stroke language, and the product promise as plain text. It
 * replaces a stock photograph the imagery brief rules out (generic scene, no
 * Bangladeshi merchant/rider/parcel context) with an on-brand illustration.
 */
function BrandPanel() {
  return (
    <section
      className="relative hidden min-h-screen overflow-hidden bg-[#0D0F12] text-white lg:block"
      aria-label="About DropX"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-32 size-[34rem] rounded-full bg-[#FF5500] opacity-[0.18] blur-[120px]"
      />

      <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
        <DropXLogo size="lg" className="text-white" />

        <div className="grid gap-10">
          <RouteIllustration />
          <div className="grid max-w-lg gap-4">
            <h1 className="text-4xl leading-[1.1] font-bold tracking-tight text-balance xl:text-5xl">
              Send it anywhere. Follow it everywhere.
            </h1>
            <p className="text-base leading-7 text-white/70">
              Book a pickup, see the fee up front, and watch your parcel move hub to hub until it
              reaches the receiver.
            </p>
          </div>
          <ul className="grid gap-3 text-sm text-white/85">
            {PROMISES.map((item) => (
              <li key={item.text} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                  <item.icon className="size-4 text-[#FF5500]" strokeWidth={1.75} aria-hidden />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function RouteIllustration() {
  return (
    <svg
      viewBox="0 0 420 120"
      className="h-auto w-full max-w-md"
      fill="none"
      role="img"
      aria-label="A parcel route from a pickup point through two hubs to a doorstep"
    >
      <path d="M24 84 C90 84 100 36 170 36 S270 84 340 84 S380 60 396 60" stroke="#fff" strokeOpacity="0.2" strokeWidth="1.75" strokeDasharray="4 6" />
      <path d="M24 84 C90 84 100 36 170 36" stroke="#FF5500" strokeWidth="1.75" strokeLinecap="round" />
      {[
        [24, 84, "Pickup"],
        [170, 36, "Origin hub"],
        [340, 84, "Dest. hub"],
        [396, 60, "Door"],
      ].map(([x, y, label], index) => (
        <g key={String(label)}>
          <circle cx={x as number} cy={y as number} r="7" fill={index < 2 ? "#FF5500" : "#1A1D24"} stroke={index < 2 ? "#FF5500" : "#fff"} strokeOpacity={index < 2 ? 1 : 0.4} strokeWidth="1.75" />
          <text x={x as number} y={(y as number) + (index === 1 ? -16 : 26)} textAnchor="middle" fill="#fff" fillOpacity="0.7" fontSize="11" fontFamily="inherit">
            {label as string}
          </text>
        </g>
      ))}
    </svg>
  )
}
