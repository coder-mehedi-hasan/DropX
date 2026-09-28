import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@dropx/ui"
import {
  BanknoteIcon,
  BoxesIcon,
  MapPinIcon,
  PackageCheckIcon,
  RouteIcon,
  ScanSearchIcon,
  TruckIcon,
} from "lucide-react"
import Link from "next/link"

import { SiteFooter, SiteHeader } from "@/components/site-chrome"
import { TrackLookup } from "@/components/track-lookup"

const STEPS = [
  {
    icon: PackageCheckIcon,
    title: "Book in a minute",
    body: "Sign in with a one-time code sent to your phone or email — no password to forget. Enter the receiver, the route and the weight, and you get a delivery fee up front.",
  },
  {
    icon: TruckIcon,
    title: "Pickup and hub to hub",
    body: "We collect the parcel, sort it at the origin hub, and move it along the route to the destination hub. Every handover is a tracking event, visible to you as it happens.",
  },
  {
    icon: MapPinIcon,
    title: "Last-mile delivery",
    body: "A rider takes the parcel out for delivery and captures proof — signature, photo, or a one-time code from the receiver. Failed attempts are retried, so a parcel never stalls silently.",
  },
  {
    icon: BanknoteIcon,
    title: "Pay on delivery",
    body: "Choose cash on delivery and collect the amount from the receiver, or prepay. Fees follow the destination zone, the weight band, and the cash amount.",
  },
] as const

const STATUSES = [
  "Created",
  "Picked up",
  "In transit",
  "At hub",
  "Out for delivery",
  "Delivered",
] as const

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
            <div className="grid gap-6">
              <Badge variant="secondary" className="w-fit">
                Parcel delivery across Bangladesh
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Send a parcel and watch every hub it passes through.
              </h1>
              <p className="text-muted-foreground max-w-prose text-lg">
                Book a collection, get a delivery fee before you commit, and follow the parcel from
                pickup to the receiver&apos;s door. No account is needed to track.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="/login">Book a parcel</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/track">Track with a number</Link>
                </Button>
              </div>
              <dl className="grid gap-4 pt-4 sm:grid-cols-3">
                <Stat label="Booking" value="One-time code" />
                <Stat label="Proof" value="Signature, photo or OTP" />
                <Stat label="Payment" value="Prepaid or cash on delivery" />
              </dl>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3">
                <h2 className="text-sm font-semibold">Already have a tracking number?</h2>
                <TrackLookup />
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <p className="text-muted-foreground mt-2 max-w-prose">
              Every parcel runs the same four stages, and each one writes to its tracking history.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {STEPS.map((step) => (
                <Card key={step.title}>
                  <CardHeader>
                    <span className="bg-muted text-muted-foreground mb-2 flex size-9 items-center justify-center rounded-md">
                      <step.icon className="size-4" aria-hidden />
                    </span>
                    <CardTitle>{step.title}</CardTitle>
                    <CardDescription>{step.body}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
              <div className="grid content-start gap-4">
                <h2 className="text-2xl font-semibold tracking-tight">Pricing and tracking</h2>
                <p className="text-muted-foreground max-w-prose">
                  The delivery fee is worked out from the destination zone, the weight band, and —
                  for cash on delivery — the amount being collected. You see the quote before you
                  book, and the API recomputes it when the parcel is created, so the price cannot
                  drift.
                </p>
                <ul className="text-muted-foreground grid gap-2 text-sm">
                  <li className="flex items-center gap-2">
                    <BoxesIcon className="size-4" aria-hidden />
                    Base price plus a per-kilogram charge for the weight band
                  </li>
                  <li className="flex items-center gap-2">
                    <BanknoteIcon className="size-4" aria-hidden />A percentage plus a handling fee
                    on cash-on-delivery amounts
                  </li>
                  <li className="flex items-center gap-2">
                    <ScanSearchIcon className="size-4" aria-hidden />
                    Public tracking for any parcel, no sign-in required
                  </li>
                </ul>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Where a parcel can be</CardTitle>
                  <CardDescription>
                    Each stage below has its own status in the tracking history.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <ol className="grid gap-2">
                    {STATUSES.map((status, index) => (
                      <li key={status} className="flex items-center gap-3">
                        <span className="text-muted-foreground w-5 text-xs tabular-nums">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm font-medium">{status}</span>
                        {index < STATUSES.length - 1 ? (
                          <Separator orientation="vertical" className="ml-auto h-4" />
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <RouteIcon className="size-4" aria-hidden />A failed delivery is retried, and a
                    parcel that cannot be delivered is returned to the sender.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}
