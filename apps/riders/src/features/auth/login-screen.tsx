import { zodResolver } from "@hookform/resolvers/zod"
import { Navigate, useRouter } from "@tanstack/react-router"
import { PackageCheck } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
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
    <main className="bg-background text-foreground mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-2xl">
          <PackageCheck className="size-7" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">DropX Rider</h1>
          <p className="text-muted-foreground mt-1 text-sm">Sign in to see today's jobs.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use the email and password from dispatch.</CardDescription>
        </CardHeader>
        <CardContent>
          {serverError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>
                <p>{serverError}</p>
              </AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        inputMode="email"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        className="h-12 text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="current-password"
                        className="h-12 text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
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
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 text-center text-xs">API: {getApiUrl()}</p>
    </main>
  )
}
