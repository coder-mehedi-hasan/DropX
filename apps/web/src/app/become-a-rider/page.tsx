import type { Metadata } from "next"
import { BanknoteIcon, Clock3Icon, MapPinIcon, ShieldCheckIcon, TruckIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@dropx/ui"

import { SiteFooter, SiteHeader } from "@/components/site-chrome"
import { RiderApplicationForm } from "@/components/rider-application-form"

export const metadata: Metadata = {
  title: "Become a rider",
  description: "Apply to deliver with DropX.",
}

const BENEFITS = [
  {
    icon: BanknoteIcon,
    title: "Earn on every delivery",
    body: "Choose a schedule that works for you and get paid for completed jobs.",
  },
  {
    icon: MapPinIcon,
    title: "Work in your area",
    body: "Tell us where you ride so our team can match opportunities nearby.",
  },
  {
    icon: Clock3Icon,
    title: "Flexible routes",
    body: "Build delivery work around your day, whether you ride part-time or full-time.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Clear support",
    body: "Get operational guidance and a clear workflow from pickup to proof of delivery.",
  },
]

export default function BecomeARiderPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative isolate overflow-hidden border-b py-16 sm:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_62%)] opacity-[0.14]"
          />
          <div className="max-w-page mx-auto grid gap-10 px-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="grid gap-5">
              <p className="text-accent-ink text-xs font-semibold tracking-[0.16em] uppercase">
                DropX rider network
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Ride with DropX. Keep Bangladesh moving.
              </h1>
              <p className="text-muted-foreground max-w-xl text-lg">
                Join a delivery network built around reliable handovers, useful routes, and work
                that fits your schedule.
              </p>
              <div className="flex items-center gap-2 text-sm font-medium">
                <TruckIcon className="text-primary size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                Apply in a few minutes. Our team will contact you after review.
              </div>
            </div>
            <Card className="rounded-feature gap-6 py-6 shadow-sm sm:py-8">
              <CardHeader>
                <CardTitle>Tell us about yourself</CardTitle>
                <p className="text-muted-foreground text-sm">
                  We’ll use this information to review your application.
                </p>
              </CardHeader>
              <CardContent>
                <RiderApplicationForm />
              </CardContent>
            </Card>
          </div>
        </section>
        <section className="max-w-page mx-auto grid gap-6 px-4 py-16">
          <div>
            <p className="text-accent-ink text-xs font-semibold tracking-[0.16em] uppercase">
              Why DropX
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              A rider experience that respects your time
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((item) => (
              <Card key={item.title} className="shadow-none">
                <CardContent className="grid gap-3 p-5">
                  <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                    <item.icon className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-5">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
