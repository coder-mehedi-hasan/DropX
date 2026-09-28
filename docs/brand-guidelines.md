# DropX brand guidelines handoff

Version: 1.2  
Owner: DropX Technologies — Brand & Product Design  
Last updated: 28 September 2026

The interactive brand book is available at `/brand-guidelines`. Production SVG assets live in `apps/web/public/brand/`.

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
