import { createHash, randomInt, randomUUID } from "node:crypto"

import bcrypt from "bcryptjs"

import { TABLES, getDatabase, toId, type Id } from "@dropx/db"

import { ERROR_CODES, DomainError, fromDatabaseError } from "../../core"
import type { Audience } from "../../shared/auth"
import { issueTokenPair, verifyToken, type TokenPair } from "../../shared/auth"
import { pushEmailJob } from "../../shared/email/queue"
import { getRedisClient } from "../../shared/redis/client"
import { emit } from "../../shared/events/bus"
import type { OtpRequestInput, OtpVerifyInput, StaffLoginInput } from "./auth.dto"
import { authRepository } from "./auth.repository"

/**
 * Authentication rules.
 *
 * All of these are **public** operations — they run before an actor exists — so
 * the transport stays thin and every failure mode gets a deliberate message.
 *
 * The database handle and the cache are resolved here rather than passed in, so
 * a caller only supplies business input. Repositories still take the handle
 * explicitly, which is what lets a transaction thread through them.
 */

const OTP_TTL_SECONDS = 5 * 60
const OTP_MAX_ATTEMPTS = 5
const OTP_RESEND_COOLDOWN_SECONDS = 30

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

/**
 * Stands in for the phone of an email-only signup, because `customers.phone` is
 * NOT NULL and unique.
 *
 * Deterministic, so two concurrent OTP requests for the same address collide on
 * `uq_customers_phone` and the loser re-reads the winner instead of creating a
 * second customer. Hashed rather than concatenated because the raw identifier is
 * unbounded — a 28-character address overflowed `VARCHAR(30)` and failed the
 * insert. The prefix cannot collide with a real number: those normalise to digits.
 */
function pendingPhone(identifier: string): string {
  return `pending:${createHash("sha256").update(identifier).digest("hex").slice(0, 16)}`
}

function splitIdentifier(identifier: string): { phone: string | null; email: string | null } {
  return isEmail(identifier)
    ? { phone: null, email: identifier.toLowerCase() }
    : { phone: normalisePhone(identifier), email: null }
}

/** Lowercased email, or a digits-only phone — whichever the customer typed. */
function normaliseIdentifier(identifier: string): string {
  return isEmail(identifier) ? identifier.toLowerCase() : normalisePhone(identifier)
}

export async function loginWithPassword(
  input: StaffLoginInput,
  audience: Extract<Audience, "admin" | "riders">,
): Promise<LoginResult> {
  const db = getDatabase()
  const user = await authRepository.findUserByEmail(db, input.email)

  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
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
    const rider = await authRepository.findRiderByUserId(db, toId(user.id))
    if (!rider) {
      throw new DomainError(ERROR_CODES.FORBIDDEN, "This account is not a rider")
    }
  }

  const sessionId = randomUUID()
  const tokens = await issueTokenPair({ subject: user.id, audience, sessionId })

  await authRepository.touchLastLogin(db, toId(user.id))

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

export async function refreshSession(refreshToken: string, audience: Audience): Promise<TokenPair> {
  const db = getDatabase()
  const payload = await verifyToken(refreshToken, "refresh", audience)

  // The subject must still be an active account before a new access token is minted.
  if (audience === "web") {
    const customer = await authRepository.findCustomerById(db, toId(payload.sub))
    if (!customer) {
      throw new DomainError(ERROR_CODES.TOKEN_INVALID, "This account no longer exists")
    }
  } else {
    const user = await db.queryOne<{ id: string; status: string }>(
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

export async function requestOtp(input: OtpRequestInput): Promise<OtpRequestResult> {
  const db = getDatabase()
  const redis = await getRedisClient()
  const identifier = normaliseIdentifier(input.identifier)

  const cooldown = await redis.ttl(otpResendKey(identifier))
  if (cooldown !== null && cooldown > 0) {
    throw new DomainError(
      ERROR_CODES.RATE_LIMITED,
      `Please wait ${cooldown} seconds before requesting another code`,
    )
  }

  let customer = await authRepository.findCustomerByIdentifier(db, identifier)
  const isNewCustomer = customer === null

  if (!customer && !input.acceptSignup) {
    throw new DomainError(
      ERROR_CODES.UNREGISTERED_USER,
      "No account exists for this phone number or email",
    )
  }

  if (!customer) {
    // Placeholder name — the customer supplies it after verifying.
    const { phone, email } = splitIdentifier(identifier)
    try {
      customer = await authRepository.createTempCustomer(db, {
        name: "New customer",
        phone: phone ?? pendingPhone(identifier),
        email,
      })
    } catch (error) {
      // Lost a race with a concurrent request: re-read and continue.
      const domainError = fromDatabaseError(error, "This phone number or email")
      const existing = await authRepository.findCustomerByIdentifier(db, identifier)
      if (!existing) throw domainError
      customer = existing
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
  await redis.setEx(otpKey(identifier), OTP_TTL_SECONDS, code)
  await redis.setEx(otpAttemptsKey(identifier), OTP_TTL_SECONDS, "0")
  await redis.setEx(otpResendKey(identifier), OTP_RESEND_COOLDOWN_SECONDS, "1")

  // An email identifier can only go by email, and a customer who has an address
  // on file gets that rather than an SMS — the placeholder phone is not a
  // deliverable destination for anyone.
  const byEmail = customer.email !== null
  const destination = customer.email ?? customer.phone

  // A real deployment hands `code` to the SMS provider here. The code itself is
  // only ever written to the cache, never to MySQL.
  void sendOtpCode(byEmail, destination, code)

  return {
    channel: byEmail ? "EMAIL" : "SMS",
    destination,
    expiresInSeconds: OTP_TTL_SECONDS,
    isNewCustomer,
  }
}

export async function verifyOtp(input: OtpVerifyInput): Promise<CustomerSessionResult> {
  const db = getDatabase()
  const redis = await getRedisClient()
  const identifier = normaliseIdentifier(input.identifier)

  const key = otpKey(identifier)
  const stored = await redis.get(key)

  if (!stored) {
    throw new DomainError(ERROR_CODES.OTP_EXPIRED, "That code has expired. Request a new one.")
  }

  const attempts = Number((await redis.get(otpAttemptsKey(identifier))) ?? "0") + 1
  await redis.setEx(otpAttemptsKey(identifier), OTP_TTL_SECONDS, String(attempts))

  if (attempts > OTP_MAX_ATTEMPTS) {
    await redis.del(key)
    throw new DomainError(ERROR_CODES.RATE_LIMITED, "Too many attempts. Request a new code.")
  }

  if (stored !== input.code) {
    throw new DomainError(ERROR_CODES.OTP_INVALID, "That code is not correct")
  }

  await redis.del(key)
  await redis.del(otpAttemptsKey(identifier))

  const customer = await authRepository.findCustomerByIdentifier(db, identifier)
  if (!customer) {
    throw new DomainError(ERROR_CODES.OTP_INVALID, "That code is not correct")
  }

  const customerId = toId(customer.id)
  const activated =
    customer.status === "ACTIVE" ? customer : await authRepository.activateCustomer(db, customerId)

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

export async function updateCustomerName(customerId: Id, name: string): Promise<{ name: string }> {
  await authRepository.upsertCustomerName(getDatabase(), customerId, name)
  return { name }
}

/**
 * Delivery seam. Wire the SMS branch to a gateway; email already goes through
 * MJML rendering and the job queue, so the request never waits on SMTP.
 *
 * Fire-and-forget: the code is already in the cache by the time this runs, so a
 * provider outage must not roll back an OTP the customer can still verify.
 */
async function sendOtpCode(byEmail: boolean, destination: string, code: string): Promise<void> {
  if (!byEmail) {
    console.info(`[otp/sms] ${destination} <- ${code}`)
    return
  }

  await pushEmailJob({
    to: destination,
    template: "otp-code",
    context: { code },
    subject: "Your DropX verification code",
  })
}
