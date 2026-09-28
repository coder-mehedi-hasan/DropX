/**
 * Email service — process-wide handle.
 *
 * Resolves the transport from config and hands it to the service layer. The
 * port is intentionally narrow so tests can swap it for a double.
 */
import { getConfig } from "../../config"
import { createEmail, type Email } from "./port"

let instance: Email | undefined

export function getEmail(): Email {
  if (instance) return instance

  const config = getConfig()
  instance = createEmail({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    user: config.mail.user,
    password: config.mail.password,
    from: config.mail.from,
  })
  return instance
}

/** Test seam. */
export function setEmail(email: Email): void {
  instance = email
}

export { createEmail, type Email, type EmailMessage } from "./port"
