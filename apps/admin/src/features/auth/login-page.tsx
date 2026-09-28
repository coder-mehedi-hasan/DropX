import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { LogIn } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Button,
  Card,
  DropXLockup,
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
} from "@dropx/ui"
import { toast } from "sonner"

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
      toast.success("Signed in")
      await navigate(resolveRedirect(redirect))
    } catch (error) {
      setServerError(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <DropXLockup />
      <Card className="w-full max-w-sm gap-0 py-0 shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">Staff sign in</CardTitle>
          <CardDescription>Use your work email and password.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
              <ServerError
                error={serverError}
                title="Unable to sign in"
                onDismiss={() => setServerError(null)}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="username"
                        placeholder="you@dropx.com"
                        disabled={submitting}
                        {...field}
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={submitting}>
                <LogIn />
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">Staff only. Access is logged against your account.</p>
    </div>
  )
}
