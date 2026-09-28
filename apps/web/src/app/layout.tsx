import type { Metadata } from "next"
import { Inter } from "next/font/google"

import { Providers } from "@/components/providers"

import "./globals.css"

/**
 * Inter, self-hosted by `next/font`.
 *
 * The brand sets Inter as the working voice — geometric, legible, and fast to
 * scan — and `--font-dropx` is the variable `@dropx/ui`'s token layer reads for
 * `font-sans`, so the whole workspace gets this one stack.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dropx",
})

export const metadata: Metadata = {
  title: {
    default: "DropX — parcel delivery",
    template: "%s · DropX",
  },
  description:
    "Book a parcel, follow it hub to hub, and pay on delivery. Track any parcel with its tracking number — no account needed.",
  icons: {
    icon: "/brand/dropx-favicon.svg",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background text-foreground min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
