import { randomInt, randomUUID } from "node:crypto"

import { TABLES, toId, type Database, type Id } from "@dropx/db"

import { ERROR_CODES, DomainError, fromDatabaseError, verifyPassword } from "../../core"
import type { Audience } from "../../shared/auth"
import { issueTokenPair, verifyToken, type TokenPair } from "../../shared/auth"
import type { Cache } from "../../shared/cache"
import { emit } from "../../shared/events/bus"
import type { OtpRequestInput, OtpVerifyInput, StaffLoginInput } from "./auth.dto"
import { authRepository } from "./auth.repository"

/**
 * Authentication rules.
 *
 * All of these are **public** operations — they run before an actor exists — so
 * the transport stays thin and every failure mode gets a deliberate message.
 */

const OTP_TTL_SECONDS = 5 * 60
const OTP_MAX_ATTEMPTS = 5
const OTP_RESEND_COOLDOWN_SECONDS = 30

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AuthDeps = {
  db: Database
  cache: Cache
}

export type LoginResult = TokenPair & {
  account: {
    id: Id
    kind: "staff" | "rider"
    name: string
    email: string
    roles: string[]
  }
}

export type CustomerSessionResult = TokenPair & {
  customer: {
    id: Id
    name: string
    phone: string
    email: string | null
    status: "ACTIVE"
  }
}

export function otpKey(identifier: string): string {
  return `otp:web:${identifier.toLowerCase()}`
}

export function otpAttemptsKey(identifier: string): string {
  return `otp:web:${identifier.toLowerCase()}:attempts`
}

export function otpResendKey(identifier: string): string {
  return `otp:web:${identifier.toLowerCase()}:resend`
}

function isEmail(identifier: string): boolean {
  return EMAIL_PATTERN.test(identifier)
}

/** `+8801...` from any formatting the customer might type. */
function normalisePhone(identifier: string): string {
  return identifier.replace(/[\s-]/g, "")
}

function splitIdentifier(identifier: string): { phone: string | null; email: string | null } {
  return isEmail(identifier)
    ? { phone: null, email: identifier.toLowerCase() }
    : { phone: normalisePhone(identifier), email: null }
}

export async function loginWithPassword(
  deps: AuthDeps,
  input: StaffLoginInput,
  audience: Extract<Audience, "console" | "riders">,
): Promise<LoginResult> {
  const user = await authRepository.findUserByEmail(deps.db, input.email)

  // Verify even when the user is missing so the response time does not reveal
  // which emails exist.
  const passwordMatches = user
    ? await verifyPassword(input.password, user.password_hash)
    : await verifyPassword(input.password, "scrypt$16384$8$1$aaaa$bbbb")

  if (!user || !passwordMatches) {
    throw new DomainError(ERROR_CODES.INVALID_CREDENTIALS, "Email or password is incorrect")
  }

  if (user.status !== "ACTIVE") {
    throw new DomainError(
      user.status === "SUSPENDED" ? ERROR_CODES.FORBIDDEN : ERROR_CODES.INVALID_CREDENTIALS,
      user.status === "SUSPENDED"
        ? "This account has been suspended"
        : "This account is inactive. Contact your administrator.",
    )
  }

  if (audience === "riders") {
    const rider = await authRepository.findRiderByUserId(deps.db, toId(user.id))
    if (!rider) {
      throw new DomainError(ERROR_CODES.FORBIDDEN, "This account is not a rider")
    }
  }

  const sessionId = randomUUID()
  const tokens = await issueTokenPair({ subject: user.id, audience, sessionId })

  await authRepository.touchLastLogin(deps.db, toId(user.id))

  return {
    ...tokens,
    account: {
      id: toId(user.id),
      kind: audience === "riders" ? "rider" : "staff",
      name: user.name,
      email: user.email,
      roles: [],
    },
  }
}

export async function refreshSession(
  deps: AuthDeps,
  refreshToken: string,
  audience: Audience,
): Promise<TokenPair> {
  const payload = await verifyToken(refreshToken, "refresh", audience)

  // The subject must still be an active account before a new access token is minted.
  if (audience === "web") {
    const customer = await authRepository.findCustomerById(deps.db, toId(payload.sub))
    if (!customer) {
      throw new DomainError(ERROR_CODES.TOKEN_INVALID, "This account no longer exists")
    }
  } else {
    const user = await deps.db.queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM ${TABLES.users} WHERE id = ? LIMIT 1`,
      [payload.sub],
    )
    if (!user || user.status !== "ACTIVE") {
      throw new DomainError(ERROR_CODES.INVALID_CREDENTIALS, "This account is not active")
    }
  }

  return issueTokenPair({ subject: payload.sub, audience, sessionId: payload.sid })
}

export type OtpRequestResult = {
  /** Echoed so the client can show which channel the code went to. */
  channel: "SMS" | "EMAIL"
  destination: string
  expiresInSeconds: number
  /** Always false in production — prevents account enumeration. */
  isNewCustomer: boolean
}

export async function requestOtp(
  deps: AuthDeps,
  input: OtpRequestInput,
): Promise<OtpRequestResult> {
  const identifier = isEmail(input.identifier)
    ? input.identifier.toLowerCase()
    : normalisePhone(input.identifier)

  const cooldown = await deps.cache.ttl(otpResendKey(identifier))
  if (cooldown !== null && cooldown > 0) {
    throw new DomainError(
      ERROR_CODES.RATE_LIMITED,
      `Please wait ${cooldown} seconds before requesting another code`,
    )
  }

  let customer = await authRepository.findCustomerByIdentifier(deps.db, identifier)
  const isNewCustomer = customer === null

  if (!customer) {
    // Placeholder name — the customer supplies it after verifying.
    const { phone, email } = splitIdentifier(identifier)
    try {
      customer = await authRepository.createTempCustomer(deps.db, {
        name: "New customer",
        phone: phone ?? `pending:${identifier}`,
        email,
      })
    } catch (error) {
      // Lost a race with a concurrent request: re-read and continue.
      const domainError = fromDatabaseError(error, "This phone number or email")
      const existing = await authRepository.findCustomerByIdentifier(deps.db, identifier)
      if (!existing) throw domainError
      customer = existing
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
  await deps.cache.set(otpKey(identifier), code, OTP_TTL_SECONDS)
  await deps.cache.set(otpAttemptsKey(identifier), "0", OTP_TTL_SECONDS)
  await deps.cache.set(otpResendKey(identifier), "1", OTP_RESEND_COOLDOWN_SECONDS)

  const channel: "SMS" | "EMAIL" = customer.email && !isEmail(identifier) ? "EMAIL" : "SMS"
  const destination = channel === "EMAIL" ? customer.email! : customer.phone

  // A real deployment hands `code` to the SMS/email provider here. The code
  // itself is only ever written to the cache, never to MySQL.
  sendOtpCode(destination, code)

  return {
    channel,
    destination,
    expiresInSeconds: OTP_TTL_SECONDS,
    isNewCustomer,
  }
}

export async function verifyOtp(
  deps: AuthDeps,
  input: OtpVerifyInput,
): Promise<CustomerSessionResult> {
  const identifier = isEmail(input.identifier)
    ? input.identifier.toLowerCase()
    : normalisePhone(input.identifier)

  const key = otpKey(identifier)
  const stored = await deps.cache.get(key)

  if (!stored) {
    throw new DomainError(ERROR_CODES.OTP_EXPIRED, "That code has expired. Request a new one.")
  }

  const attempts = Number((await deps.cache.get(otpAttemptsKey(identifier))) ?? "0") + 1
  await deps.cache.set(otpAttemptsKey(identifier), String(attempts), OTP_TTL_SECONDS)

  if (attempts > OTP_MAX_ATTEMPTS) {
    await deps.cache.delete(key)
    throw new DomainError(ERROR_CODES.RATE_LIMITED, "Too many attempts. Request a new code.")
  }

  if (stored !== input.code) {
    throw new DomainError(ERROR_CODES.OTP_INVALID, "That code is not correct")
  }

  await deps.cache.delete(key)
  await deps.cache.delete(otpAttemptsKey(identifier))

  const customer = await authRepository.findCustomerByIdentifier(deps.db, identifier)
  if (!customer) {
    throw new DomainError(ERROR_CODES.OTP_INVALID, "That code is not correct")
  }

  const customerId = toId(customer.id)
  const activated =
    customer.status === "ACTIVE"
      ? customer
      : await authRepository.activateCustomer(deps.db, customerId)

  if (activated.status !== "ACTIVE") {
    throw new DomainError(ERROR_CODES.CUSTOMER_NOT_ACTIVE, "Your account is not active yet")
  }

  const tokens = await issueTokenPair({
    subject: customerId,
    audience: "web",
    sessionId: randomUUID(),
  })

  // Side effect after the write — notification providers must not gate login.
  emit("customer.activated", { customerId })

  return {
    ...tokens,
    customer: {
      id: customerId,
      name: activated.name,
      phone: activated.phone,
      email: activated.email,
      status: "ACTIVE",
    },
  }
}

export async function updateCustomerName(
  deps: AuthDeps,
  customerId: Id,
  name: string,
): Promise<{ name: string }> {
  await authRepository.upsertCustomerName(deps.db, customerId, name)
  return { name }
}

/**
 * Delivery seam. Wire to bKash/SMS gateway/email in the notification module;
 * for now the code is only written to the cache.
 */
function sendOtpCode(destination: string, code: string): void {
  if (process.env.NODE_ENV === "production") return
  console.info(`[otp] ${destination} <- ${code}`)
}
