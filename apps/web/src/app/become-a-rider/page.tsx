import type { Metadata } from "next"
import { BanknoteIcon, CheckIcon, Clock3Icon, MapPinIcon, ShieldCheckIcon } from "lucide-react"

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

const APPLICATION_STEPS = [
  "Add your contact details",
  "Tell us about your riding setup",
  "Review and send your application",
]

export default function BecomeARiderPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative isolate overflow-hidden bg-[#F7F8FA] py-10 sm:py-14 lg:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 -z-10 h-[34rem] w-[52rem] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[#FF5500]/10 blur-3xl"
          />
          <div className="max-w-page mx-auto grid gap-10 px-4 lg:grid-cols-[minmax(0,0.78fr)_minmax(36rem,1.22fr)] lg:items-start lg:gap-12">
            <div className="grid gap-8 lg:sticky lg:top-24 lg:pt-8">
              <div className="grid gap-5">
                <p className="text-accent-ink flex items-center gap-3 text-xs font-semibold tracking-[0.16em] uppercase">
                  <span className="h-px w-8 bg-current" aria-hidden />
                  DropX rider network
                </p>
                <h1 className="max-w-[15ch] text-4xl leading-[0.98] font-extrabold tracking-[-0.045em] text-balance sm:text-5xl">
                  Ride with purpose. Deliver with DropX.
                </h1>
                <p className="text-muted-foreground max-w-lg text-base leading-7 text-pretty sm:text-lg">
                  Put your local knowledge to work on reliable routes, with clear handovers and an
                  operations team behind every delivery.
                </p>
              </div>

              <ol className="grid gap-4 border-l border-black/10 pl-5">
                {APPLICATION_STEPS.map((step, index) => (
                  <li key={step} className="relative flex items-center gap-3 text-sm font-medium">
                    <span className="absolute top-1/2 -left-[1.65rem] size-3 -translate-y-1/2 rounded-full border-[3px] border-[#F7F8FA] bg-[#FF5500]" />
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      0{index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>

              <div className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(13,15,18,.05)] ring-1 ring-black/5">
                <span className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <CheckIcon className="size-4" strokeWidth={2} aria-hidden />
                </span>
                <p className="text-muted-foreground text-sm leading-6">
                  The form takes a few minutes. We’ll contact you after review—there is no fee to
                  apply.
                </p>
              </div>
            </div>
            <Card className="rounded-feature gap-0 overflow-hidden border-0 py-0 shadow-[0_2px_3px_rgba(13,15,18,.04),0_28px_80px_-34px_rgba(13,15,18,.28)] ring-1 ring-black/5">
              <CardHeader className="border-b border-black/6 bg-white px-5 py-6 sm:px-8 sm:py-7">
                <p className="text-accent-ink text-xs font-semibold tracking-[0.14em] uppercase">
                  Rider application
                </p>
                <CardTitle className="mt-1 text-2xl font-bold tracking-[-0.025em]">
                  Apply to ride with DropX
                </CardTitle>
                <p className="text-muted-foreground max-w-xl text-sm leading-6">
                  Three short steps. Required fields are marked with an asterisk.
                </p>
              </CardHeader>
              <CardContent className="px-5 py-6 sm:px-8 sm:py-8">
                <RiderApplicationForm />
              </CardContent>
            </Card>
          </div>
        </section>
        <section className="bg-[#0D0F12] text-white">
          <div className="max-w-page mx-auto grid gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:py-24">
            <div className="self-start lg:sticky lg:top-24">
              <p className="text-xs font-semibold tracking-[0.16em] text-[#FF8A50] uppercase">
                Why DropX
              </p>
              <h2 className="mt-3 max-w-[14ch] text-3xl leading-tight font-bold tracking-[-0.03em] text-balance sm:text-4xl">
                Delivery work built around real routes
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#B8BDC7]">
                Straightforward operations, practical support, and work close to the areas you know.
              </p>
            </div>
            <div className="grid border-t border-white/12 sm:grid-cols-2">
              {BENEFITS.map((item, index) => (
                <article
                  key={item.title}
                  className="group grid gap-4 border-b border-white/12 py-7 sm:px-6 sm:odd:border-r lg:py-8"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-white/8 text-[#FF7A38] transition-colors duration-200 group-hover:bg-[#FF5500] group-hover:text-white">
                      <item.icon className="size-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="font-mono text-xs text-white/35 tabular-nums">
                      0{index + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#B8BDC7]">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
