import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import mjml2html from "mjml"

const __dirname = dirname(fileURLToPath(import.meta.url))
const templatesDir = join(__dirname, "templates")

type TemplateName = "otp-code"

type TemplateContext = {
  code: string
}

const cache = new Map<string, string>()

async function loadTemplate(name: TemplateName): Promise<string> {
  const cached = cache.get(name)
  if (cached) return cached

  const source = await readFile(join(templatesDir, `${name}.mjml`), "utf8")
  cache.set(name, source)
  return source
}

export type RenderedEmail = {
  html: string
  text: string
}

export async function renderEmail(
  template: TemplateName,
  context: TemplateContext,
): Promise<RenderedEmail> {
  const source = await loadTemplate(template)
  const html = source.replace(/\{\{code\}\}/g, context.code)
  const { html: rendered } = await mjml2html(html)
  return {
    html: rendered,
    text: `DropX — Your verification code\n\nUse the code below to complete your sign-in. It expires in 5 minutes.\n\n${context.code}\n\nIf you did not request this code, you can ignore this email.`,
  }
}

export function otpEmail(code: string): Promise<RenderedEmail> {
  return renderEmail("otp-code", { code })
}
