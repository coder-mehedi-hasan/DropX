import { zodResolver } from "@hookform/resolvers/zod"
import { createRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  Form,
  FormInput,
  FormPasswordInput,
  LoadingButton,
} from "@dropx/ui"

import { describeApiError } from "../components/feedback"
import { useAuth } from "../lib/auth"
import { appLayoutRoute } from "./app-layout"

const schema = z
  .object({
    newPassword: z.string().min(8, "Use at least 8 characters").max(200),
    confirmPassword: z.string().min(8, "Confirm your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })

type Values = z.infer<typeof schema>

export const changePasswordRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/change-password",
  component: ChangePasswordScreen,
})

function ChangePasswordScreen() {
  const { changePassword, logout, rider } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    try {
      await changePassword(values.newPassword)
      await navigate({ to: "/jobs", replace: true })
    } catch (error) {
      setServerError(describeApiError(error).message)
    }
  })

  async function onSignOut() {
    await logout()
    await navigate({ to: "/login", replace: true })
  }

  return (
    <main className="bg-background text-foreground flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6 shadow-lg sm:p-8">
        <p className="text-primary text-sm font-semibold">Welcome to DropX, {rider?.name}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Set your password</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-5">
          Your administrator gave you a temporary password. Choose a private password before you
          access rider jobs.
        </p>
        {serverError ? (
          <Alert variant="destructive" className="mt-5">
            <AlertTitle>Could not update password</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}
        <Form {...form}>
          <form onSubmit={onSubmit} className="mt-6 grid gap-5" noValidate>
            <FormPasswordInput<Values>
              name="newPassword"
              label="New password"
              autoComplete="new-password"
            />
            <FormInput<Values>
              name="confirmPassword"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
            />
            <LoadingButton type="submit" size="lg" loading={form.formState.isSubmitting}>
              Save password
            </LoadingButton>
            <button
              type="button"
              className="text-muted-foreground text-sm underline underline-offset-4"
              onClick={() => void onSignOut()}
            >
              Sign out
            </button>
          </form>
        </Form>
      </Card>
    </main>
  )
}
