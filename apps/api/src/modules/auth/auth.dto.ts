import { z } from "zod";

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
  .regex(/^\+?[0-9\s-]+$/, "Enter a valid phone number");

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(255);

export const staffLoginSchema = z.object({
  email,
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

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
  .refine((value) => (value.includes("@") ? email.safeParse(value).success : phone.safeParse(value).success), {
    message: "Enter a valid phone number or email address",
  });

export const otpRequestSchema = z.object({
  identifier: otpIdentifier,
  consent: z.literal(true, {
    error: "You must accept the terms to continue",
  }),
});

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  identifier: otpIdentifier,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
