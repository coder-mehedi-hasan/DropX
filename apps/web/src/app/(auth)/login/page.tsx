import type { Metadata } from "next"

import { LoginScreen } from "@/components/login-screen"

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in with a one-time code sent to your phone number or email. DropX customers do not have a password.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const params = await searchParams
  const raw = params.next
  const requested = Array.isArray(raw) ? raw[0] : raw

  return <LoginScreen requestedPath={requested} />
}
