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

export type RenderedEmail = {
  html: string
  text: string
  attachments: Array<{
    filename: string
    content: string
    cid: string
    contentType: string
  }>
}

export async function renderEmail(
  template: TemplateName,
  context: TemplateContext,
): Promise<RenderedEmail> {
  const [source, brandSignature] = await Promise.all([loadTemplate(template), loadFile(brandAsset)])

  const html = source
    .replace(/\{\{code\}\}/g, context.code)
    .replace(/\{\{brandSignatureCid\}\}/g, "cid:dropx-email-signature-light")
  const { html: rendered } = await mjml2html(html)
  return {
    html: rendered,
    text: `DropX — Your verification code\n\nUse the code below to complete your sign-in. It expires in 5 minutes.\n\n${context.code}\n\nIf you did not request this code, you can ignore this email.`,
    attachments: [
      {
        filename: "dropx-email-signature-light.svg",
        content: brandSignature,
        cid: "dropx-email-signature-light",
        contentType: "image/svg+xml",
      },
    ],
  }
}

export function otpEmail(code: string): Promise<RenderedEmail> {
  return renderEmail("otp-code", { code })
}
