"use client"

import {
  Accessibility,
  ArrowDown,
  ArrowUpRight,
  Clipboard,
  Info,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Table2,
  Zap,
} from "lucide-react"
import { useState } from "react"

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@dropx/ui"
import { SiteFooter, SiteHeader } from "@/components/site-chrome"

const COLORS = [
  { name: "Volt Orange", hex: "#FF5500", use: "Actions, highlights, progress", className: "bg-[#FF5500]" },
  { name: "Deep Obsidian", hex: "#0D0F12", use: "Dark canvas and navigation", className: "bg-[#0D0F12]" },
  { name: "Carbon Gray", hex: "#1A1D24", use: "Dark cards and raised surfaces", className: "bg-[#1A1D24]" },
  { name: "Terminal Green", hex: "#00C853", use: "Success and completed delivery", className: "bg-[#00C853]" },
  { name: "Alert Amber", hex: "#F59E0B", use: "Pending and in-transit attention", className: "bg-[#F59E0B]" },
  { name: "Pure White", hex: "#FFFFFF", use: "Light surfaces and headlines", className: "bg-white" },
] as const

export default function BrandGuidelinesPage() {
  const [copied, setCopied] = useState<string | null>(null)

  async function copyColor(hex: string) {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(hex)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900">
      <SiteHeader />

      <nav className="sticky top-16 z-30 hidden border-b border-gray-200 bg-white/90 backdrop-blur md:block">
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-5 overflow-x-auto px-4 text-xs font-medium text-gray-500">
          {[
            ["overview", "Overview"],
            ["colors", "Colors"],
            ["modes", "Modes"],
            ["type", "Typography"],
            ["logo", "Logo"],
            ["voice", "Voice"],
            ["components", "Components"],
          ].map(([href, label]) => (
            <a key={href} href={`#${href}`} className="whitespace-nowrap transition-colors hover:text-[#FF5500]">
              {label}
            </a>
          ))}
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-gray-200">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,85,0,.16),_transparent_58%)]" />
          <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:py-28">
            <Badge className="border border-orange-500/20 bg-orange-500/10 text-[#FF8A4C] hover:bg-orange-500/10">Official brand guidelines · v1.1</Badge>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-gray-900 text-balance sm:text-6xl lg:text-7xl">
              Building the future of <span className="bg-gradient-to-r from-[#FF5500] to-amber-400 bg-clip-text text-transparent">smart logistics</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-gray-600 sm:text-lg">
              A practical identity system for every DropX touchpoint—from the first booking to the final handover. Fast, clear, and dependable by design.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs font-medium text-gray-600">
              {['Fast by default', 'Clear under pressure', 'Human at every handoff'].map((item) => (
                <span key={item} className="rounded-full border border-gray-200 bg-white px-3 py-1.5">{item}</span>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild className="bg-[#FF5500] text-white hover:bg-[#E64D00]"><a href="#colors">Explore the system <ArrowDown className="ml-2 size-4" /></a></Button>
              <Button asChild variant="outline" className="border-gray-300 bg-white text-gray-900 hover:bg-gray-100 hover:text-gray-900"><a href="#components">View components</a></Button>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-24 px-4 py-20">
          <Section id="overview" number="01" title="Core philosophy" description="The principles behind every DropX decision." />
          <div className="-mt-16 grid gap-4 md:grid-cols-3">
            <Principle icon={<Zap />} title="Lightning speed" body="Remove friction from pickup to doorstep. Every screen should make the next action obvious." />
            <Principle icon={<ShieldCheck />} title="Absolute trust" body="Use clear status, transparent pricing, and visible proof at every handover." />
            <Principle icon={<Sparkles />} title="Merchant simplicity" body="Make the complex logistics network feel calm, predictable, and easy to operate." />
          </div>

          <section id="colors" className="scroll-mt-32">
            <Section number="02" title="Color system" description="Volt Orange brings energy to a grounded system of obsidian, carbon, and semantic status colors." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COLORS.map((color) => (
                <button key={color.hex} type="button" onClick={() => void copyColor(color.hex)} className="group rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-[#FF5500]/70 focus-visible:outline-[#FF8A4C]">
                  <div className={`flex h-28 items-end justify-end rounded-xl border border-black/10 p-3 ${color.className}`}>
                    <span className="rounded-md bg-black/40 px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100">{copied === color.hex ? "Copied" : "Copy token"}</span>
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-3"><div><h3 className="font-semibold text-gray-900">{color.name}</h3><p className="mt-1 text-xs text-gray-500">{color.use}</p></div><code className="rounded-md bg-orange-50 px-2 py-1 text-xs text-[#D94300]">{color.hex}</code></div>
                </button>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900"><strong className="text-gray-900">Accessibility rule:</strong> never use color alone. Pair status colors with a label, icon, or shape; target 4.5:1 contrast for body text.</div>
          </section>

          <section id="modes" className="scroll-mt-32">
            <Section number="03" title="Light & dark mode" description="One DropX identity, two carefully balanced environments." />
            <div className="grid gap-4 lg:grid-cols-2">
              <ModeCard dark icon={<Moon />} title="Dark mode" canvas="#0D0F12" surface="#1A1D24" body="The primary environment for operations, tracking, and rider workflows. Use Obsidian as the canvas and Carbon for raised surfaces." />
              <ModeCard icon={<Sun />} title="Light mode" canvas="#F7F8FA" surface="#FFFFFF" body="Use for customer-facing pages, printable documents, and bright environments. Keep orange for action and progress—not large backgrounds." />
            </div>
            <p className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600"><strong className="text-gray-900">Mode rule:</strong> do not simply invert colors. Preserve semantic meaning, contrast, elevation, and focus visibility when switching themes.</p>
          </section>

          <section id="type" className="scroll-mt-32">
            <Section number="04" title="Typography" description="Inter is the working voice: geometric, legible, and fast to scan." />
            <div className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <TypeRow label="Display / H1" sample="DropX moves what matters." detail="Inter ExtraBold 800 · marketing and hero banners" className="text-4xl font-extrabold sm:text-5xl" />
              <TypeRow label="Heading / H2" sample="Every handover is visible." detail="Inter Bold 700 · section titles and cards" className="text-2xl font-bold" />
              <TypeRow label="Body / UI" sample="Book, track, and deliver with confidence." detail="Inter Regular 400 / Medium 500 · app interfaces" className="text-base text-gray-700" last />
            </div>
          </section>

          <section id="logo" className="scroll-mt-32">
            <Section number="05" title="Logo & identity mark" description="Keep the mark recognizable, balanced, and easy to find." />
            <div className="grid gap-4 md:grid-cols-2">
              <LogoLockup light={false} />
              <LogoLockup light />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-gray-200 bg-white p-8"><img src="/brand/dropx-lockup-light.svg" alt="DropX large light lockup" className="h-auto w-full max-w-md" /></div>
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-white/10 bg-[#1A1D24] p-8"><img src="/brand/dropx-lockup-dark.svg" alt="DropX large dark lockup" className="h-auto w-full max-w-md" /></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <RuleCard title="Clear space" body="Keep a minimum clear space around the lockup equal to the height of the orange D-mark on all sides." />
              <RuleCard title="Protect the identity" body="Use approved colors, preserve proportions, and never stretch, rotate, or add effects to the mark." />
            </div>
          </section>

          <section id="voice" className="scroll-mt-32">
            <Section number="06" title="Brand voice" description="Every message should sound capable, direct, and human." />
            <div className="grid gap-4 md:grid-cols-3">
              <VoiceCard icon="→" title="Direct" body={'Lead with what happened and what to do next. Prefer “Pickup confirmed” over a long passive sentence.'} />
              <VoiceCard icon="◌" title="Reassuring" body="When plans change, explain the next step, give a useful time frame, and avoid blame or vague promises." />
              <VoiceCard icon="✦" title="Energetic" body="Use momentum, not hype. Let fast, useful experiences prove the promise." />
            </div>
          </section>

          <section id="components" className="scroll-mt-32">
            <Section number="07" title="Product components" description="Patterns for forms, inputs, tables, and the moments where work gets done." />
            <div className="space-y-4">
              <Card className="border-gray-200 bg-white text-gray-900 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><MousePointerIcon /> Forms & inputs</CardTitle><CardDescription className="text-gray-600">Labels stay visible. Focus is orange. Error messages explain how to recover.</CardDescription></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-3"><Field label="Tracking number" value="DX-10482" /><Field label="Recipient phone" placeholder="01XXXXXXXXX" /><div className="grid gap-2"><Label className="text-gray-700">Delivery zone</Label><select className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-[#FF5500] focus:outline-none"><option>Dhaka North</option><option>Dhaka South</option></select></div></div><div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500"><span><strong className="text-gray-900">Focus:</strong> orange border + subtle ring</span><span><strong className="text-red-600">Error:</strong> red border + message below</span><span><strong className="text-gray-700">Disabled:</strong> lower contrast, keep context</span></div></CardContent></Card>

              <Card className="overflow-hidden border-gray-200 bg-white text-gray-900 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Table2 className="size-5 text-[#FF5500]" /> Tables</CardTitle><CardDescription className="text-gray-600">Optimize for scanning. Right-align numbers and keep status labels short.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500"><tr><th className="px-3 py-3">Parcel</th><th className="px-3 py-3">Destination</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">COD amount</th></tr></thead><tbody className="divide-y divide-gray-200"><TableRow parcel="DX-10482" destination="Gulshan 2" status="Delivered" statusClass="bg-green-100 text-green-700" amount="৳ 1,280" /><TableRow parcel="DX-10483" destination="Mirpur 10" status="In transit" statusClass="bg-amber-100 text-amber-700" amount="৳ 860" /></tbody></table></CardContent></Card>

              <div className="grid gap-4 md:grid-cols-3"><RuleCard title="Buttons" body="One primary action per region. Use sentence case and verbs: Create parcel, Assign rider." icon={<ArrowUpRight />} /><RuleCard title="Status" body="Green means complete, amber means attention, red means blocked. Always include text." icon={<Info />} /><RuleCard title="Responsive" body="Stack forms on small screens. Let tables scroll horizontally; never shrink critical data until unreadable." icon={<Accessibility />} /></div>
            </div>
          </section>
        </div>
      </main>

      {copied ? <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-orange-300 bg-[#FF5500] px-4 py-3 text-sm font-medium text-white shadow-2xl"><Clipboard className="size-4" /> Copied {copied}</div> : null}
      <SiteFooter />
    </div>
  )
}

function Section({ id, number, title, description }: { id?: string; number: string; title: string; description: string }) {
  return <div id={id} className="mb-8 scroll-mt-32 border-l-4 border-[#FF5500] pl-4"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#D94300]">{number}</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{title}</h2><p className="mt-1 text-sm text-gray-600">{description}</p></div>
}

function Principle({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <Card className="border-gray-200 bg-white text-gray-900 shadow-sm transition hover:-translate-y-1 hover:border-[#FF5500]/60"><CardHeader><span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-orange-50 text-[#FF5500]">{icon}</span><CardTitle>{title}</CardTitle><CardDescription className="text-gray-600">{body}</CardDescription></CardHeader></Card>
}

function ModeCard({ dark = false, icon, title, canvas, surface, body }: { dark?: boolean; icon: React.ReactNode; title: string; canvas: string; surface: string; body: string }) {
  return <div className={`rounded-2xl border p-7 ${dark ? "border-white/10 bg-[#1A1D24]" : "border-gray-200 bg-white text-gray-900"}`}><div className="flex items-center gap-3"><span className={`flex size-9 items-center justify-center rounded-lg ${dark ? "bg-[#0D0F12] text-gray-300" : "bg-gray-100 text-gray-700"}`}>{icon}</span><h3 className="text-xl font-bold">{title}</h3></div><p className={`mt-4 text-sm leading-relaxed ${dark ? "text-gray-400" : "text-gray-600"}`}>{body}</p><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className={`rounded-lg border p-3 ${dark ? "border-white/10 bg-[#0D0F12]" : "border-gray-200 bg-gray-50"}`}><span className="block text-gray-500">Canvas</span><code>{canvas}</code></div><div className={`rounded-lg border p-3 ${dark ? "border-white/10 bg-[#232731]" : "border-gray-200 bg-white"}`}><span className="block text-gray-500">Surface</span><code>{surface}</code></div></div></div>
}

function TypeRow({ label, sample, detail, className, last = false }: { label: string; sample: string; detail: string; className: string; last?: boolean }) {
  return <div className={`flex flex-col gap-3 py-2 md:flex-row md:items-center md:justify-between ${last ? "" : "border-b border-gray-200 pb-6"}`}><div><p className="text-xs font-mono uppercase tracking-wider text-[#D94300]">{label}</p><p className={`mt-1 ${className}`}>{sample}</p></div><p className="text-xs text-gray-500 md:text-right">{detail}</p></div>
}

function LogoLockup({ light }: { light: boolean }) {
  return <div className={`flex min-h-56 flex-col items-center justify-center rounded-2xl border p-8 text-center ${light ? "border-gray-200 bg-white" : "border-white/10 bg-[#1A1D24]"}`}><img src={light ? "/brand/dropx-wordmark-light.svg" : "/brand/dropx-wordmark-dark.svg"} alt={`DropX wordmark for ${light ? "light" : "dark"} backgrounds`} className="h-auto w-full max-w-xs" /><p className={`mt-4 text-xs font-semibold uppercase tracking-widest ${light ? "text-gray-500" : "text-gray-400"}`}>{light ? "Light background wordmark" : "Dark background wordmark"}</p></div>
}

function RuleCard({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-2"><h3 className="font-bold text-gray-900">{title}</h3>{icon ? <span className="text-[#FF5500]">{icon}</span> : null}</div><p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p></div>
}

function VoiceCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <Card className="border-gray-200 bg-white text-gray-900 shadow-sm"><CardHeader><span className="text-2xl text-[#FF5500]">{icon}</span><CardTitle className="mt-2">{title}</CardTitle><CardDescription className="text-gray-600">{body}</CardDescription></CardHeader></Card>
}

function Field({ label, value, placeholder }: { label: string; value?: string; placeholder?: string }) {
  return <div className="grid gap-2"><Label className="text-gray-700">{label}</Label><Input value={value} placeholder={placeholder} readOnly={Boolean(value)} className="border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:border-[#FF5500] focus-visible:ring-[#FF5500]/30" /></div>
}

function TableRow({ parcel, destination, status, statusClass, amount }: { parcel: string; destination: string; status: string; statusClass: string; amount: string }) {
  return <tr className="transition hover:bg-gray-50"><td className="px-3 py-4 font-medium text-gray-900">{parcel}</td><td className="px-3 py-4 text-gray-600">{destination}</td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>{status}</span></td><td className="px-3 py-4 text-right font-mono text-gray-700">{amount}</td></tr>
}

function MousePointerIcon() {
  return <MessageCircle className="size-5 text-[#FF5500]" />
}
