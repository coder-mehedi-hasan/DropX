import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { LogIn } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  AppToast,
  Card,
  DropXLogo,
  Form,
  FormInput,
  FormPasswordInput,
  LoadingButton,
} from "@dropx/ui"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { resolveRedirect } from "@/lib/navigation"

/** Mirrors the API's `staffLoginSchema` so the failure surfaces before a round trip. */
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: "/login" })
  const [serverError, setServerError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  useEffect(() => {
    if (status === "authenticated") void navigate(resolveRedirect(redirect))
  }, [status, navigate, redirect])

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    setSubmitting(true)
    try {
      await login(values.email, values.password)
      AppToast.success("Signed in")
      await navigate(resolveRedirect(redirect))
    } catch (error) {
      setServerError(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <DropXLogo size="lg" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Staff sign in</h1>
          <p className="text-muted-foreground mt-2 text-sm">Use your work email and password.</p>
        </div>
        <Card className="rounded-feature border-border/80 p-6 shadow-lg sm:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-6">
              <ServerError
                error={serverError}
                title="Unable to sign in"
                onDismiss={() => setServerError(null)}
              />

              <FormInput<LoginValues>
                name="email"
                label="Email"
                type="email"
                autoComplete="username"
                placeholder="you@dropx.com"
                disabled={submitting}
              />

              <FormPasswordInput<LoginValues>
                name="password"
                label="Password"
                autoComplete="current-password"
                disabled={submitting}
              />

              <LoadingButton type="submit" size="lg" className="mt-2 w-full" loading={submitting}>
                <LogIn />
                Sign in
              </LoadingButton>
            </form>
          </Form>
        </Card>
        <p className="text-muted-foreground mt-6 text-center text-xs">
          Staff only. Access is logged against your account.
        </p>
      </div>
    </main>
  )
}
