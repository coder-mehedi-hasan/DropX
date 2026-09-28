import type { Metadata } from "next"

import { Providers } from "@/components/providers"

import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "DropX — parcel delivery",
    template: "%s · DropX",
  },
  description:
    "Book a parcel, follow it hub to hub, and pay on delivery. Track any parcel with its tracking number — no account needed.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
