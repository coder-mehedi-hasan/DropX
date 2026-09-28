# DropX brand guidelines handoff

Version: 1.2  
Owner: DropX Technologies — Brand & Product Design  
Last updated: 28 September 2026

The interactive brand book is available at `/brand-guidelines`. Production SVG assets live in `apps/web/public/brand/`.

The brand page is light-first. Dark mode is documented as a product environment and demonstrated with paired dark surfaces, controls, status badges, and logo lockups; it is not the default site theme.

## Asset matrix

| Context | Approved asset |
| --- | --- |
| Public site, app, or navigation | `dropx-wordmark-light.svg` / `dropx-wordmark-dark.svg` |
| Tight UI, favicon, app icon, avatar | `dropx-mark.svg` / `dropx-favicon.svg` |
| Social profile or app-store tile | `dropx-social-avatar.svg` |
| Social cover or campaign header | `dropx-social-cover-light.svg` / `dropx-social-cover-dark.svg` |
| Vertical story/reel | `dropx-social-story-light.svg` |
| Large hero, poster, or presentation cover | `dropx-lockup-*.svg` / `dropx-stack-*.svg` |
| Bangladesh/local campaign | `dropx-campaign-bangladesh-light.svg` and Bangla light/dark variants |
| Partner co-marketing | `dropx-partner-badge-light.svg` |
| Parcel or counter sticker | `dropx-sticker-delivered.svg` |
| Email signature | `dropx-email-signature-light.svg` |
| One-color production | `dropx-mark-mono-*.svg` / `dropx-wordmark-mono-*.svg` |

Do not manually combine the mark and wordmark. Select an approved asset from the matrix and preserve its original aspect ratio and clear space.

## Digital component contract

- Buttons use sentence case and verb-first labels. Use one primary action per region.
- Button states cover default, hover, focus, pressed, loading, disabled, and destructive confirmation.
- Status badges include an icon or text label; color alone is never sufficient. Supported parcel states are Created, In transit, Out for delivery, Delivered, Failed, and Returned.
- Inputs keep visible labels. Focus uses the orange ring; errors explain recovery; disabled controls retain enough contrast to preserve context.
- Tables optimize for scanning: right-align numeric values, keep status labels short, and allow horizontal scroll on small screens.
- Responsive layouts stack forms, keep primary actions reachable, and preserve table information instead of shrinking it below readability.

## Layout and interaction tokens

- Base spacing unit: 4px; preferred scale: 4, 8, 12, 16, 24, 32, 48, 64.
- Container: 1200px maximum; reading measure: approximately 640px.
- Breakpoints: 640, 768, 1024, and 1280px.
- Default radius: 12px; feature radius: 16px.
- Motion: 150–200ms for feedback and 200–300ms for navigation; honor `prefers-reduced-motion`.
- Iconography: Lucide-style outline icons, 1.75px stroke, 16px dense UI, 20px buttons, 24px feature cards.

## Imagery and localization

The imagery brief is at `apps/web/public/brand/imagery/README.md`. Photography should show real Bangladeshi merchant, rider, parcel, and receiver moments with purposeful movement. The same subject should crop safely to 16:9, 1:1, and 9:16 formats.

Bangla assets must be reviewed by a native speaker before external publication. Keep copy editable until approval and allow for longer translated strings in UI layouts.

## Release checklist

- Logo proportions and clear space approved.
- Light, dark, monochrome, social, local campaign, partner, sticker, favicon, and email variants supplied.
- Wordmark source files must be outlined before print/vendor handoff. The web SVGs retain font-family metadata for maintainability.
- Confirm trademark registration and jurisdictional usage with legal counsel before external publication. This repository makes no registration claim.
- Confirm the final copyright line with the legal owner before campaigns go live.

## Contrast audit

Ratios below are calculated from the shipped sRGB values using WCAG 2 relative luminance. Normal text passes at 4.5:1; large text passes at 3:1; UI boundaries/focus indicators target 3:1.

| Foreground | Background | Ratio | Result | Approved use |
| --- | --- | ---: | --- | --- |
| `#0D0F12` | `#FFFFFF` | 19.08:1 | Pass | Body, headings, controls |
| `#475467` | `#FFFFFF` | 7.01:1 | Pass | Secondary/body text |
| `#D94300` | `#FFFFFF` | 5.13:1 | Pass | Accent text and links |
| `#FF5500` | `#FFFFFF` | 3.17:1 | Large/UI only | Buttons, large type, non-text accent |
| `#FFFFFF` | `#FF5500` | 3.17:1 | Large/UI only | Primary button text and large type |
| `#FFFFFF` | `#0D0F12` | 19.08:1 | Pass | Dark-mode body and headings |
| `#FFFFFF` | `#1A1D24` | 15.10:1 | Pass | Dark-mode cards and controls |
| `#0D0F12` | `#F7F8FA` | 18.17:1 | Pass | Light canvas and body |

Status colors must always include a text label or icon. Do not use green, amber, or red as the only status signal.

## Print handoff

1. Use SVG for vector production and PDF for print delivery.
2. Convert wordmark text to outlined paths in the design source file before handing off to a vendor.
3. Proof CMYK values physically; the digital CMYK values are starting points, not a color-management guarantee.
4. Preserve minimum sizes: mark 8mm in print, horizontal wordmark 25mm wide, descriptor lockups only when the descriptor remains legible.
5. Keep clear space equal to the mark height on every side.

## Localization

Bangla campaign assets are supplied as `dropx-campaign-bangladesh-bn-light.svg` and `dropx-campaign-bangladesh-bn-dark.svg`. Review typography with a native Bangla speaker before campaign release, and keep text editable until copy approval.

## Source files

The repository SVGs are the implementation source for the web. A design-team source file (Figma, Illustrator, or equivalent) should be maintained outside the codebase with outlined wordmarks, print color swatches, and campaign templates. Do not create new logo combinations by editing the production exports manually.

## Change control

Brand changes require review by DropX Brand & Product Design. When changing a logo, token, component rule, campaign lockup, or localization, update all three locations together:

1. `apps/web/src/app/brand-guidelines/page.tsx` — interactive reference.
2. `apps/web/public/brand/` — production assets and selection guide.
3. `docs/brand-guidelines.md` — written contract and handoff record.

Update the version and last-updated date for material changes. Confirm trademark status, copyright ownership, and final campaign copy with the legal owner before external release; this repository does not make a trademark-registration claim.
