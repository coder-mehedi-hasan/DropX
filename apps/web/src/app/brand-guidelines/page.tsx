"use client"

import {
  Accessibility,
  ArrowDown,
  ArrowUpRight,
  Camera,
  Check,
  Clipboard,
  FileText,
  Globe2,
  Grid3X3,
  Info,
  MonitorSmartphone,
  MessageCircle,
  Moon,
  Move,
  Palette,
  Package,
  Printer,
  ShieldCheck,
  Sparkles,
  Sun,
  Table2,
  Timer,
  X,
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

const COLOR_SPECS = [
  ["Volt Orange", "#FF5500", "255 85 0", "0 67 100 0", "Accent / action"],
  ["Deep Obsidian", "#0D0F12", "13 15 18", "28 17 0 93", "Dark canvas"],
  ["Carbon Gray", "#1A1D24", "26 29 36", "28 19 0 86", "Dark surface"],
  ["Terminal Green", "#00C853", "0 200 83", "100 0 58 22", "Success"],
  ["Alert Amber", "#F59E0B", "245 158 11", "0 36 96 4", "Attention"],
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
            ["layout", "Layout"],
            ["icons", "Icons"],
            ["imagery", "Imagery"],
            ["motion", "Motion"],
            ["content", "Content"],
            ["production", "Production"],
            ["governance", "Governance"],
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
          <div className="grid gap-4 md:grid-cols-3">
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
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-200 px-6 py-4"><h3 className="font-semibold text-gray-900">Production color specifications</h3><p className="mt-1 text-xs text-gray-500">CMYK values are starting points for print proofing; always approve against a physical proof.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500"><tr><th className="px-6 py-3">Color</th><th className="px-6 py-3">HEX</th><th className="px-6 py-3">RGB</th><th className="px-6 py-3">CMYK</th><th className="px-6 py-3">Role</th></tr></thead><tbody className="divide-y divide-gray-100">{COLOR_SPECS.map(([name, hex, rgb, cmyk, role]) => <tr key={name}><td className="px-6 py-3 font-medium text-gray-900">{name}</td><td className="px-6 py-3 font-mono text-xs text-[#D94300]">{hex}</td><td className="px-6 py-3 font-mono text-xs text-gray-600">{rgb}</td><td className="px-6 py-3 font-mono text-xs text-gray-600">{cmyk}</td><td className="px-6 py-3 text-gray-600">{role}</td></tr>)}</tbody></table></div></div>
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
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <RuleCard title="Minimum digital size" body="Use the mark at 24px minimum. Use the horizontal wordmark at 120px wide minimum." />
              <RuleCard title="Minimum print size" body="Use the mark at 8mm minimum. Use the full lockup at 25mm wide minimum." />
              <RuleCard title="Monochrome" body="Use mono-black on light stock and mono-white on dark stock only when color reproduction is unavailable." />
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

          <section id="layout" className="scroll-mt-32">
            <Section number="08" title="Layout & visual language" description="A calm, generous system that keeps logistics information easy to scan." />
            <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
              <Card className="border-gray-200 bg-white text-gray-900 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Grid3X3 className="size-5 text-[#FF5500]" /> Grid and spacing</CardTitle><CardDescription className="text-gray-600">Use a 4px base unit and a 12-column desktop grid. Let space create hierarchy before adding borders.</CardDescription></CardHeader><CardContent><div className="grid gap-3 text-sm"><TokenLine label="Base unit" value="4px" /><TokenLine label="Spacing scale" value="4 · 8 · 12 · 16 · 24 · 32 · 48 · 64" /><TokenLine label="Content width" value="1200px max · 640px reading measure" /><TokenLine label="Breakpoints" value="640 / 768 / 1024 / 1280px" /><TokenLine label="Card radius" value="12px default · 16px feature" /></div></CardContent></Card>
              <Card className="border-gray-200 bg-white text-gray-900 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Move className="size-5 text-[#FF5500]" /> Elevation</CardTitle><CardDescription className="text-gray-600">Reserve depth for hierarchy and interaction.</CardDescription></CardHeader><CardContent className="grid gap-3"><div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-sm font-medium">Level 1 · card</p><p className="mt-1 text-xs text-gray-500">Quiet separation from the canvas</p></div><div className="rounded-xl border border-gray-200 bg-white p-4 shadow-lg"><p className="text-sm font-medium">Level 2 · popover</p><p className="mt-1 text-xs text-gray-500">Temporary focus or decision</p></div></CardContent></Card>
            </div>
          </section>

          <section id="icons" className="scroll-mt-32">
            <Section number="09" title="Iconography" description="Icons should clarify an action or status, never decorate an empty space." />
            <div className="grid gap-4 md:grid-cols-3">
              <RuleCard icon={<Palette />} title="Style" body="Use Lucide-style outline icons with a 1.75px stroke, rounded joins, and a 24px viewbox." />
              <RuleCard icon={<Accessibility />} title="Meaning" body="Pair an icon with text for critical status. Never communicate success, failure, or warning by icon color alone." />
              <RuleCard icon={<MonitorSmartphone />} title="Sizing" body="16px in dense UI, 20px in buttons, 24px in feature cards. Align to the text baseline." />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-6 rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm"><span className="flex items-center gap-2 text-sm"><Check className="size-4 text-green-600" /> Approved: consistent stroke</span><span className="flex items-center gap-2 text-sm text-gray-500"><X className="size-4" /> Avoid: mixed filled and outline families</span></div>
          </section>

          <section id="imagery" className="scroll-mt-32">
            <Section number="10" title="Imagery & illustration" description="Show real movement, real people, and the confidence that comes from visibility." />
            <div className="grid gap-4 md:grid-cols-3">
              <ImagePrinciple icon={<Camera />} title="Human and in motion" body="Prefer documentary-style images of riders, merchants, parcels, and handoffs. Capture purposeful movement, not staged smiles." />
              <ImagePrinciple icon={<Package />} title="Product first" body="Parcels should look handled, labeled, and real. Keep backgrounds simple enough for UI overlays and copy." />
              <ImagePrinciple icon={<Sparkles />} title="Warm, not glossy" body="Use natural light, deep neutrals, and one orange accent. Avoid generic warehouse stock imagery and heavy filters." />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-[#0D0F12] p-8 text-white"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#FF8A4C]">Do</p><p className="mt-3 text-lg font-semibold">A rider hands a clearly labeled parcel to a receiver.</p><p className="mt-2 text-sm text-gray-400">Visible context, real handoff, clear human benefit.</p></div><div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-gray-500"><p className="text-xs font-semibold uppercase tracking-[.16em]">Avoid</p><p className="mt-3 text-lg font-semibold text-gray-700">A generic delivery truck with no DropX context.</p><p className="mt-2 text-sm">If the story could belong to any courier, it is not specific enough.</p></div></div>
          </section>

          <section id="motion" className="scroll-mt-32">
            <Section number="11" title="Motion & interaction" description="Motion should explain a change in parcel state and get out of the way." />
            <div className="grid gap-4 md:grid-cols-3"><MotionCard icon={<Timer />} title="Quick feedback" value="150–200ms" body="Hover, focus, button press, and inline validation." /><MotionCard icon={<ArrowUpRight />} title="Navigation" value="200–300ms" body="Sheets, menus, page transitions, and status reveals." /><MotionCard icon={<Zap />} title="Reduce motion" value="Respect setting" body="Remove travel and looping animation when reduced motion is enabled." /></div>
          </section>

          <section id="content" className="scroll-mt-32">
            <Section number="12" title="Content & localization" description="Write for busy people, then make the same clarity work in every language." />
            <div className="grid gap-4 lg:grid-cols-2"><Card className="border-gray-200 bg-white text-gray-900 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-[#FF5500]" /> Message patterns</CardTitle></CardHeader><CardContent className="grid gap-3"><CopyExample label="Success" good="Pickup confirmed" bad="Your pickup request has been successfully processed" /><CopyExample label="Delay" good="Pickup delayed · We’ll update you by 4:00 PM" bad="There has been an unexpected issue" /><CopyExample label="Error" good="Enter a valid 11-digit phone number" bad="Invalid input" /></CardContent></Card><Card className="border-gray-200 bg-white text-gray-900 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="size-5 text-[#FF5500]" /> Localization</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-gray-600"><p>Use plain English and short sentences. Keep labels expandable for longer translations.</p><p>Support Bangla copy without shrinking type below 14px. Test mixed-script numbers, dates, and currency.</p><p>Keep brand names, tracking numbers, and status labels consistent across channels.</p></CardContent></Card></div>
          </section>

          <section id="production" className="scroll-mt-32">
            <Section number="13" title="Production applications" description="The identity should be unmistakable on screen, in print, and on the road." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><ApplicationCard icon={<Package />} title="Packaging" body="Obsidian base, centered orange lockup, generous clear space." /><ApplicationCard icon={<MonitorSmartphone />} title="Digital" body="Light-first customer surfaces; dark operational surfaces where focus matters." /><ApplicationCard icon={<Printer />} title="Print" body="Use the light lockup on white stock and preserve a minimum 12mm mark height." /><ApplicationCard icon={<Move />} title="Fleet & gear" body="High-visibility orange mark on navy or obsidian; prioritize legibility at distance." /></div>
            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900"><strong className="text-gray-900">Export rule:</strong> use SVG for digital and large-format work, PDF for print handoff, and PNG only when a raster asset is required. Never screenshot a logo from the website.</div>
          </section>

          <section id="governance" className="scroll-mt-32">
            <Section number="14" title="Governance & handoff" description="A brand system stays useful when ownership and change are explicit." />
            <div className="grid gap-4 md:grid-cols-3"><RuleCard title="Source of truth" body="Keep logo assets in apps/web/public/brand and update this page with every approved identity change." /><RuleCard title="Versioning" body="Current release: v1.1 · 28 September 2026. Record material palette, typography, or logo changes here." /><RuleCard title="Owner" body="DropX Brand & Product Design. Request review before creating a new logo, status color, or campaign lockup." /></div>
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

function TokenLine({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-1 border-b border-gray-100 pb-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-gray-500">{label}</span><code className="text-sm text-gray-900 sm:text-right">{value}</code></div>
}

function ImagePrinciple({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <Card className="border-gray-200 bg-white text-gray-900 shadow-sm"><CardHeader><span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-orange-50 text-[#FF5500]">{icon}</span><CardTitle>{title}</CardTitle><CardDescription className="text-gray-600">{body}</CardDescription></CardHeader></Card>
}

function MotionCard({ icon, title, value, body }: { icon: React.ReactNode; title: string; value: string; body: string }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><span className="flex size-9 items-center justify-center rounded-lg bg-orange-50 text-[#FF5500]">{icon}</span><p className="mt-5 text-xs font-semibold uppercase tracking-[.16em] text-[#D94300]">{title}</p><p className="mt-2 text-2xl font-bold text-gray-900">{value}</p><p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p></div>
}

function CopyExample({ label, good, bad }: { label: string; good: string; bad: string }) {
  return <div className="grid gap-2 border-b border-gray-100 pb-3 text-sm sm:grid-cols-[70px_1fr]"><span className="font-medium text-gray-500">{label}</span><div className="grid gap-1"><span className="text-green-700">✓ {good}</span><span className="text-gray-400 line-through">{bad}</span></div></div>
}

function ApplicationCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><span className="text-[#FF5500]">{icon}</span><h3 className="mt-4 font-bold text-gray-900">{title}</h3><p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p></div>
}

function MousePointerIcon() {
  return <MessageCircle className="size-5 text-[#FF5500]" />
}
