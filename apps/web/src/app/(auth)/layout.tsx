import { DropXLogo, Separator } from "@dropx/ui"
import Link from "next/link"
import type * as React from "react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-page items-center px-4">
          <Link href="/" className="text-foreground hover:text-foreground">
            <DropXLogo size="md" />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12">{children}</main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-page items-center justify-between px-4 py-6 text-sm">
          <p>No password, ever — we send you a code.</p>
          <Separator orientation="vertical" className="h-4" />
          <Link href="/track" className="hover:text-foreground">
            Track without signing in
          </Link>
        </div>
      </footer>
    </div>
  )
}
