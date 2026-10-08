import { zodResolver } from "@hookform/resolvers/zod"
import { Navigate, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  DropXLogo,
  Form,
  FormInput,
  FormPasswordInput,
  LoadingButton,
} from "@dropx/ui"
import { LockKeyhole, Navigation } from "lucide-react"

import { describeApiError } from "../../components/feedback"
import { useAuth } from "../../lib/auth"

/**
 * Mirrors `staffLoginSchema` in `apps/api/src/modules/auth/auth.dto.ts`: the
 * password floor of 8 characters is enforced here too, so a rider is told on the
 * phone instead of after a round trip.
 */
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .email("Enter a valid email address")
    .max(255, "That email address is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200, "That password is too long"),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginScreen() {
  const { status, login } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  if (status === "authenticated") return <Navigate to="/jobs" replace />

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    try {
      await login(values)
      await router.navigate({ to: "/jobs" })
    } catch (error) {
      setServerError(describeApiError(error).message)
    }
  })

  return (
    <main className="rider-auth-canvas text-foreground relative flex min-h-dvh w-full justify-center overflow-hidden px-4 pt-10 pb-8 sm:items-center sm:py-12">
      <div className="rider-route-grid pointer-events-none absolute inset-x-0 top-0 h-80" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 px-1 text-white sm:mb-10">
          <DropXLogo size="lg" className="text-white" />
          <div className="mt-9 flex items-center gap-2 text-sm font-semibold text-white/70">
            <Navigation className="text-primary size-4" aria-hidden />
            Rider workspace
          </div>
          <h1 className="mt-3 max-w-sm text-4xl leading-[1.02] font-extrabold tracking-[-0.045em] text-balance">
            Ready for today&apos;s route?
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-6 text-white/65">
            Your assigned stops, delivery updates, and proof of handover in one place.
          </p>
        </div>

        <Card className="rider-auth-card rounded-[1.5rem] border-0 p-5 sm:p-7">
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight">Sign in</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Use your rider account to continue.
            </p>
          </div>
          {serverError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>
                <p>{serverError}</p>
              </AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form onSubmit={onSubmit} className="grid gap-5" noValidate>
              <FormInput<LoginValues>
                name="email"
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="bg-background h-13 rounded-xl text-base"
              />

              <FormPasswordInput<LoginValues>
                name="password"
                label="Password"
                autoComplete="current-password"
                className="bg-background h-13 rounded-xl text-base"
              />

              <LoadingButton
                type="submit"
                size="lg"
                className="tap-target mt-1 h-13 w-full rounded-xl text-base font-semibold shadow-[0_10px_28px_color-mix(in_oklab,var(--primary)_28%,transparent)] transition-transform active:scale-[0.98]"
                loading={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
              </LoadingButton>
            </form>
          </Form>

          <p className="text-muted-foreground mt-6 flex items-center justify-center gap-2 text-center text-xs">
            <LockKeyhole className="size-3.5" aria-hidden />
            Protected access for active DropX riders
          </p>
        </Card>
      </div>
    </main>
  )
}
