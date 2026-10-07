import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import mjml2html from "mjml"

const __dirname = dirname(fileURLToPath(import.meta.url))
const templatesDir = join(__dirname, "templates")
const brandAsset = join(__dirname, "../../../../web/public/brand/dropx-email-signature-light.svg")

export type TemplateName = "otp-code"

type TemplateContext = {
  code: string
}

const cache = new Map<string, string>()

async function loadFile(path: string): Promise<string> {
  const cached = cache.get(path)
  if (cached) return cached
  const source = await readFile(path, "utf8")
  cache.set(path, source)
  return source
}

async function loadTemplate(name: TemplateName): Promise<string> {
  return loadFile(join(templatesDir, `${name}.mjml`))
}

function svgDataUri(source: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(source, "utf8").toString("base64")}`
}

export type RenderedEmail = {
  html: string
  text: string
}

export type EmailRenderOptions = {
  brandAssetUrl?: string
}

export async function renderEmail(
  template: TemplateName,
  context: TemplateContext,
  options: EmailRenderOptions = {},
): Promise<RenderedEmail> {
  const [source, brandSignatureSrc] = await Promise.all([
    loadTemplate(template),
    options.brandAssetUrl
      ? Promise.resolve(options.brandAssetUrl)
      : loadFile(brandAsset).then(svgDataUri),
  ])

  const html = source
    .replace(/\{\{\s*code\s*\}\}/g, context.code)
    .replace(/\{\{brandSignatureSrc\}\}/g, brandSignatureSrc)
  const { html: rendered } = await mjml2html(html)
  return {
    html: rendered,
    text: `DropX — Your verification code\n\nUse the code below to complete your sign-in. It expires in 5 minutes.\n\n${context.code}\n\nIf you did not request this code, you can ignore this email.`,
  }
}

export function otpEmail(code: string): Promise<RenderedEmail> {
  return renderEmail("otp-code", { code })
}
