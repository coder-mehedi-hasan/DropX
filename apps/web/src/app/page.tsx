import { Button, StatusBadge } from "@dropx/ui"
import {
  ArrowRightIcon,
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

const PREVIEW = [
  { title: "Out for delivery", meta: "Rider assigned · Dhaka" },
  { title: "Arrived at destination hub", meta: "Every handover is logged" },
  { title: "Left origin hub", meta: "Hub to hub transfer" },
  { title: "Picked up", meta: "Collected from the sender" },
] as const

const STATUSES = [
  "CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "AT_HUB",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="relative isolate overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_20%_-10%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
          />
          <div className="max-w-page mx-auto grid w-full gap-14 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
            <div className="grid gap-8">
              <p className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.18em] uppercase">
                <span className="bg-primary size-1.5 rounded-full" aria-hidden />
                Parcel delivery across Bangladesh
              </p>
              <h1 className="text-5xl leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl">
                Every parcel, <span className="text-primary">every hub</span>, in plain sight.
              </h1>
              <p className="text-muted-foreground max-w-xl text-lg leading-8">
                Book a collection, know the fee before you commit, and follow your parcel from
                pickup to the receiver&apos;s door. Tracking never needs an account.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="h-12 px-6 text-base" asChild>
                  <Link href="/login">
                    Book a parcel
                    <ArrowRightIcon aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                  <Link href="/track">Track with a number</Link>
                </Button>
              </div>
            </div>

            <div className="bg-card rounded-feature relative grid gap-6 border p-6 shadow-[0_1px_2px_rgb(13_15_18/0.04),0_24px_48px_-12px_rgb(13_15_18/0.12)] sm:p-8">
              <div className="grid gap-1">
                <h2 className="text-lg font-bold tracking-tight">Track a parcel</h2>
                <p className="text-muted-foreground text-sm">
                  Enter a tracking number to see where it is right now.
                </p>
              </div>
              <TrackLookup embedded />
              <div className="grid gap-4 border-t pt-5">
                <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
                  What you will see
                </p>
                <ol className="relative grid gap-4">
                  <span
                    aria-hidden
                    className="bg-border absolute top-2 bottom-2 left-[4.5px] w-px"
                  />
                  {PREVIEW.map((row, index) => (
                    <li key={row.title} className="relative flex items-start gap-4">
                      <span
                        className={`relative mt-1 size-2.5 shrink-0 rounded-full ${index === 0 ? "bg-primary ring-primary/20 ring-4" : "bg-border ring-card ring-4"}`}
                        aria-hidden
                      />
                      <div className="grid gap-0.5">
                        <p className="text-sm leading-none font-medium">{row.title}</p>
                        <p className="text-muted-foreground text-xs">{row.meta}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          <div className="border-y">
            <dl className="max-w-page mx-auto grid w-full divide-y px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Stat label="Booking" value="One-time code, no password" />
              <Stat label="Proof of delivery" value="Signature, photo or OTP" />
              <Stat label="Payment" value="Prepaid or cash on delivery" />
            </dl>
          </div>
        </section>

        <section id="how-it-works" className="bg-[#0D0F12] text-white">
          <div className="max-w-page mx-auto w-full px-4 py-24">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#FF5500] uppercase">
              How it works
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-[-0.025em] text-balance sm:text-5xl">
              Four stages, one parcel history.
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-8 text-white/60">
              Every parcel runs the same four stages, and each one writes to its tracking history.
            </p>

            <ol className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="grid content-start gap-4 border-t border-white/15 pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold tabular-nums text-[#FF5500]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <step.icon className="size-5 text-white/50" strokeWidth={1.75} aria-hidden />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-sm leading-6 text-white/60">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing">
          <div className="max-w-page mx-auto w-full px-4 py-24">
            <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-start">
              <div className="grid content-start gap-5">
                <p className="text-accent-ink text-xs font-semibold tracking-[0.18em] uppercase">
                  Pricing
                </p>
                <h2 className="text-4xl font-bold tracking-[-0.025em] text-balance sm:text-5xl">
                  A fee you can see before you commit.
                </h2>
                <p className="text-muted-foreground max-w-prose text-lg leading-8">
                  The delivery fee follows the destination zone, the weight band and — for cash on
                  delivery — the amount collected. You see the quote before you book, and it is
                  recomputed when the parcel is created, so the price cannot drift.
                </p>
                <ul className="mt-2 grid gap-4 text-sm">
                  {[
                    [BoxesIcon, "Base price plus a per-kilogram charge for the weight band"],
                    [BanknoteIcon, "A percentage plus a handling fee on cash-on-delivery amounts"],
                    [ScanSearchIcon, "Public tracking for any parcel, no sign-in required"],
                  ].map(([Icon, text]) => {
                    const I = Icon as typeof BoxesIcon
                    return (
                      <li key={text as string} className="flex items-center gap-3">
                        <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                          <I className="size-4" strokeWidth={1.75} aria-hidden />
                        </span>
                        {text as string}
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="bg-card rounded-feature border p-6 shadow-[0_1px_2px_rgb(13_15_18/0.04),0_24px_48px_-12px_rgb(13_15_18/0.10)] sm:p-8">
                <h3 className="text-lg font-bold tracking-tight">Where a parcel can be</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Each stage has its own status in the tracking history.
                </p>
                <ol className="mt-6 divide-y">
                  {STATUSES.map((status, index) => (
                    <li key={status} className="flex items-center gap-4 py-3">
                      <span className="text-muted-foreground w-6 text-xs tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <StatusBadge status={status} />
                    </li>
                  ))}
                </ol>
                <p className="text-muted-foreground mt-5 flex items-start gap-2 border-t pt-5 text-xs leading-5">
                  <RouteIcon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />A
                  failed delivery is retried, and a parcel that cannot be delivered is returned to
                  the sender.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-page mx-auto w-full px-4 pb-24">
          <div className="rounded-feature relative isolate overflow-hidden border bg-[#0D0F12] px-8 py-14 text-white sm:px-14">
            <div
              aria-hidden
              className="absolute -top-24 -right-16 -z-10 size-80 rounded-full bg-[#FF5500] opacity-25 blur-[100px]"
            />
            <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="grid max-w-xl gap-3">
                <p className="text-xs font-semibold tracking-[0.18em] text-[#FF5500] uppercase">
                  Join the network
                </p>
                <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                  Want to ride with DropX?
                </h2>
                <p className="leading-7 text-white/65">
                  Bring your vehicle, choose a schedule that works for you, and help deliver parcels
                  across Bangladesh.
                </p>
              </div>
              <Button size="lg" className="h-12 px-6 text-base" asChild>
                <Link href="/become-a-rider">
                  Become a rider
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
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
    <div className="grid gap-1.5 px-0 py-6 sm:px-8 sm:first:pl-0 sm:last:pr-0">
      <dt className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd className="text-base font-semibold tracking-tight">{value}</dd>
    </div>
  )
}
