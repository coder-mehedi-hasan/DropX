import type { Metadata } from "next"
import {
  ArrowRightIcon,
  BanknoteIcon,
  CalculatorIcon,
  ClockIcon,
  LifeBuoyIcon,
  MailIcon,
  PackageCheckIcon,
  PhoneIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react"
import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dropx/ui"

import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Help center",
  description: "Answers to common questions about booking, tracking, payment and delivery.",
}

/**
 * Contact details are placeholders until support publishes real ones — swap
 * the `support@dropx.example` / hotline values here and nowhere else.
 */
const CONTACT_EMAIL = "support@dropx.example"
const CONTACT_PHONE = "+880 1700-000000"
const CONTACT_HOURS = "Saturday – Thursday, 9:00 – 18:00 (Asia/Dhaka)"

const GROUPS: {
  title: string
  icon: typeof SparklesIcon
  items: { question: string; answer: string }[]
}[] = [
  {
    title: "Booking a parcel",
    icon: SparklesIcon,
    items: [
      {
        question: "Do I need an account to send a parcel?",
        answer:
          "Yes. Sign in with your phone number or email — we send a one-time code, there is no password to remember. The person receiving your parcel does not need an account at all.",
      },
      {
        question: "How is the delivery fee calculated?",
        answer:
          "From the route's pricing lane, the weight band the parcel lands in, and — for cash on delivery — the amount being collected. You see the quote while you fill the form, and it is recomputed when the parcel is created, so the price cannot drift.",
      },
      {
        question: "Can I use a saved address?",
        answer:
          "Yes — save addresses under Saved addresses, then pick one on the booking form to fill the city, zone, area and address line in one step.",
      },
    ],
  },
  {
    title: "Tracking",
    icon: SearchIcon,
    items: [
      {
        question: "How do I track a parcel?",
        answer:
          "Open Track in the sidebar for parcels you sent, or use the public tracking page with a tracking number — no sign-in is required, which makes it easy to send the link to whoever is waiting for the parcel.",
      },
      {
        question: "What do the statuses mean?",
        answer:
          "CREATED → PICKED_UP → IN_TRANSIT / AT_HUB → OUT_FOR_DELIVERY → DELIVERED, with FAILED, CANCELLED and RETURNED as the outcomes when a delivery does not complete. Every change is written to the parcel's event history.",
      },
    ],
  },
  {
    title: "Payment and COD",
    icon: BanknoteIcon,
    items: [
      {
        question: "How does cash on delivery work?",
        answer:
          "The receiver pays the rider when the parcel is handed over. You choose COD or prepaid at booking, and the cash amount you declare is shown in the quote — a percentage plus a handling fee applies to it.",
      },
      {
        question: "When do I see the fee I will pay?",
        answer:
          "Before you commit. The booking form shows a live quote, the calculator gives the same estimate on its own, and the price list page shows every band behind it.",
      },
    ],
  },
  {
    title: "Delivery problems",
    icon: PackageCheckIcon,
    items: [
      {
        question: "What happens if delivery fails?",
        answer:
          "The rider attempts again — retries are tracked as separate attempts on the same parcel, so you see how many have happened. If it still cannot be delivered, the parcel is returned to you.",
      },
      {
        question: "Can I change the address after booking?",
        answer:
          "Not from the portal — parcel details are locked once booked. Contact support with your tracking number and we will sort out the next step with you.",
      },
    ],
  },
]

export default function HelpPage() {
  return (
    <div className="grid gap-7">
      <PageHeader
        eyebrow="Help center"
        title="Answers, and a way to reach us."
        description="The questions we hear most, grouped by what you were doing when they came up."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {GROUPS.map((group) => (
          <Card
            key={group.title}
            className="py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5"
          >
            <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-6">
              <span className="mb-2 flex size-9 items-center justify-center rounded-xl bg-[#FFF0EB] text-[#E64D00]">
                <group.icon className="size-4.5" aria-hidden />
              </span>
              <CardTitle className="text-base font-semibold">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-2 sm:px-6">
              <Accordion type="multiple" className="divide-y divide-black/[0.07]">
                {group.items.map((item) => (
                  <AccordionItem key={item.question} value={item.question} className="border-none">
                    <AccordionTrigger className="py-3.5 text-sm hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-sm">{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-stretch">
        <Card className="bg-[#0D0F12] py-0 text-white shadow-[0_24px_60px_-30px_rgba(13,15,18,.9)]">
          <CardHeader className="gap-2 px-5 pt-6 pb-4 sm:px-7">
            <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#FF5500] text-white shadow-[0_10px_24px_-12px_rgba(255,85,0,.9)]">
              <LifeBuoyIcon className="size-5" aria-hidden />
            </span>
            <CardTitle className="text-xl font-bold tracking-[-0.02em]">Still stuck?</CardTitle>
            <CardDescription className="text-[#C8CBD1]">
              Send us your tracking number and what went wrong — it is the fastest way to an answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 px-5 pb-6 text-sm sm:px-7">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
            >
              <MailIcon className="size-4 text-[#FF8A4C]" aria-hidden />
              <span className="font-medium">{CONTACT_EMAIL}</span>
            </a>
            <a
              href={`tel:${CONTACT_PHONE.replace(/[^+\d]/g, "")}`}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
            >
              <PhoneIcon className="size-4 text-[#FF8A4C]" aria-hidden />
              <span className="font-medium tabular-nums">{CONTACT_PHONE}</span>
            </a>
            <p className="flex items-center gap-3 px-1 pt-1 text-xs text-[#8B909A]">
              <ClockIcon className="size-3.5 shrink-0" aria-hidden />
              {CONTACT_HOURS}
            </p>
          </CardContent>
        </Card>

        <Card className="py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
          <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-6">
            <CardTitle className="text-base font-semibold">Or start here</CardTitle>
            <CardDescription>The three things most people came to do.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 px-5 py-5 sm:px-6">
            <Button asChild variant="outline" className="justify-between bg-white">
              <Link href="/book">
                Book a parcel
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-between bg-white">
              <Link href="/dashboard/track">
                Track a parcel
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-between bg-white">
              <Link href="/calculator">
                Estimate a price
                <CalculatorIcon aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
