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

import { describeApiError } from "../../components/feedback"
import { getApiUrl } from "../../lib/api-client"
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
    <main className="bg-background text-foreground flex min-h-dvh w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <DropXLogo size="lg" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Rider sign in</h1>
          <p className="text-muted-foreground mt-2 text-sm">Sign in to see today&apos;s jobs.</p>
        </div>

        <Card className="rounded-feature border-border/80 p-6 shadow-lg sm:p-8">
          {serverError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>
                <p>{serverError}</p>
              </AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form onSubmit={onSubmit} className="grid gap-6" noValidate>
              <FormInput<LoginValues>
                name="email"
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="h-12 text-base"
              />

              <FormPasswordInput<LoginValues>
                name="password"
                label="Password"
                autoComplete="current-password"
                className="h-12 text-base"
              />

              <LoadingButton
                type="submit"
                size="lg"
                className="tap-target mt-2 w-full text-base"
                loading={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
              </LoadingButton>
            </form>
          </Form>
        </Card>
      </div>
    </main>
  )
}
