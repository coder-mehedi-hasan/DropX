/**
 * Email port.
 *
 * Narrow interface over whatever transport actually delivers mail. The service
 * layer takes an `Email` so tests can pass a double; the adapter wraps Nodemailer
 * and the MJML templates.
 */
export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
}

export type Email = {
  send(message: EmailMessage): Promise<void>
}

export type EmailConfig = {
  host?: string
  port?: number
  secure?: boolean
  user?: string
  password?: string
  from: string
}

const noop: Email = {
  async send() {
    // No transport configured — dev/test default. Mail is silently dropped so
    // a missing provider key never crashes a request.
  },
}

export function createEmail(config: EmailConfig): Email {
  if (!config.host || !config.password) return noop

  return new SmtpEmail(config)
}

class SmtpEmail implements Email {
  private transporter: ReturnType<typeof import("nodemailer").createTransport> | undefined

  constructor(private readonly config: EmailConfig) {}

  private async getTransporter() {
    if (this.transporter) return this.transporter
    const nodemailer = await import("nodemailer")
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
    })
    return this.transporter
  }

  async send(message: EmailMessage): Promise<void> {
    const transporter = await this.getTransporter()
    await transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
  }
}
