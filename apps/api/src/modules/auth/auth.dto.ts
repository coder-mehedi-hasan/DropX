import { z } from "zod"

/**
 * Boundary DTOs for `auth`.
 *
 * Whitelist-only and stricter than the entities: an `UpdateUserInput` never
 * accepts `id`, `status` or `passwordHash` from a client, and the login DTO
 * carries the target app so the issued token gets the right audience.
 */

const phone = z
  .string()
  .trim()
  .min(10, "Enter a valid phone number")
  .max(30)
  .regex(/^\+?[0-9\s-]+$/, "Enter a valid phone number")

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(255)

export const staffLoginSchema = z.object({
  email,
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
})

export type StaffLoginInput = z.infer<typeof staffLoginSchema>

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
})

export type RefreshInput = z.infer<typeof refreshSchema>

/**
 * `identifier` is a phone number or an email — the portal accepts either, and
 * the service resolves which it is. Consent is explicit and required, so the
 * TEMP customer row always has a `consentAcceptedAt`.
 */
const otpIdentifier = z
  .string()
  .trim()
  .min(3, "Enter your phone number or email")
  .max(255)
  .refine(
    (value) =>
      value.includes("@") ? email.safeParse(value).success : phone.safeParse(value).success,
    {
      message: "Enter a valid phone number or email address",
    },
  )

export const otpRequestSchema = z.object({
  identifier: otpIdentifier,
  consent: z.literal(true, {
    error: "You must accept the terms to continue",
  }),
  acceptSignup: z.boolean().optional().default(false),
})

export type OtpRequestInput = z.infer<typeof otpRequestSchema>

export const otpVerifySchema = z.object({
  identifier: otpIdentifier,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
})

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>

// --- Response bodies -------------------------------------------------------

/** Issued tokens plus the signed-in account, returned by the password logins. */
export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  account: z.object({
    id: z.string(),
    kind: z.enum(["staff", "rider"]),
    name: z.string().nullable(),
    email: z.string().nullable(),
    roles: z.array(z.string()),
  }),
})

/** Tokens only — the `refresh` exchange returns no account. */
export const tokenPairResponseSchema = loginResponseSchema.pick({
  accessToken: true,
  refreshToken: true,
  expiresIn: true,
})

/** OTP exchange: tokens plus the now-ACTIVE customer. */
export const otpVerifyResponseSchema = tokenPairResponseSchema.extend({
  customer: z.object({
    id: z.string(),
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    status: z.literal("ACTIVE"),
  }),
})

/** 202 from `POST /auth/otp/request` — confirms delivery, reveals nothing else. */
export const otpRequestResponseSchema = z.object({
  channel: z.enum(["SMS", "EMAIL"]),
  destination: z.string(),
  expiresInSeconds: z.number(),
  isNewCustomer: z.boolean(),
})

/** `GET /auth/me` — a discriminated union over the actor kinds. */
export const meResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("staff"),
    audience: z.string(),
    id: z.string(),
    email: z.string(),
    roles: z.array(z.string()),
    permissions: z.array(z.string()),
    branchId: z.string().nullable(),
    hubIds: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("rider"),
    audience: z.string(),
    id: z.string(),
    riderId: z.string(),
    hubId: z.string().nullable(),
    email: z.string(),
    permissions: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("customer"),
    audience: z.string(),
    id: z.string(),
    status: z.string(),
  }),
])
