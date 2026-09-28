import { bearerSecurity, errorResponse } from "../components"
import { jsonSchemaOf, okResponseSchema } from "../schema"
import {
  loginResponseSchema,
  meResponseSchema,
  otpRequestResponseSchema,
  otpVerifyResponseSchema,
  refreshSchema,
  staffLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
  tokenPairResponseSchema,
} from "../../modules/auth/auth.dto"

/**
 * `auth` operations.
 *
 * Every request body and response is the same Zod schema the route validates
 * with, so this file never restates a field — it only describes the operation
 * (id, policy, response codes) that the schema cannot express.
 */

const json = (schema: ReturnType<typeof jsonSchemaOf>) => ({
  content: { "application/json": { schema } },
})

const unauth = errorResponse("Not authenticated, or the token is missing/expired.")

export const authPaths = {
  "/auth/admin/login": {
    post: {
      operationId: "auth.loginAdmin",
      summary: "Staff login",
      description:
        "Exchanges email + password for an admin-audience token pair. Replaces the portal's login step for staff.",
      tags: ["auth"],
      security: [],
      requestBody: { required: true, ...json(jsonSchemaOf(staffLoginSchema, "input")) },
      responses: {
        200: { description: "Signed in.", ...json(jsonSchemaOf(loginResponseSchema, "output")) },
        400: errorResponse("Invalid credentials or malformed body."),
      },
    },
  },
  "/auth/riders/login": {
    post: {
      operationId: "auth.loginRider",
      summary: "Rider login",
      description:
        "Exchanges email + password for a rider-audience token pair. The audience differs from admin, so the token cannot be replayed on staff routes.",
      tags: ["auth"],
      security: [],
      requestBody: { required: true, ...json(jsonSchemaOf(staffLoginSchema, "input")) },
      responses: {
        200: { description: "Signed in.", ...json(jsonSchemaOf(loginResponseSchema, "output")) },
        400: errorResponse("Invalid credentials or malformed body."),
      },
    },
  },
  "/auth/{audience}/refresh": {
    post: {
      operationId: "auth.refresh",
      summary: "Refresh a session",
      description:
        "Exchanges a refresh token for a new pair. The audience is a path segment, not a body field, so an admin refresh token cannot be exchanged for a rider one.",
      tags: ["auth"],
      security: [],
      parameters: [
        {
          name: "audience",
          in: "path",
          required: true,
          schema: { type: "string", enum: ["admin", "riders", "web"] },
        },
      ],
      requestBody: { required: true, ...json(jsonSchemaOf(refreshSchema, "input")) },
      responses: {
        200: {
          description: "Refreshed.",
          ...json(jsonSchemaOf(tokenPairResponseSchema, "output")),
        },
        401: unauth,
      },
    },
  },
  "/auth/otp/request": {
    post: {
      operationId: "auth.otpRequest",
      summary: "Request an OTP",
      description:
        "Customer login step 1. Sends a 6-digit code to a phone number or email. Consent must be accepted; a returning ACTIVE customer is signed straight in, a first-time one is created as TEMP.",
      tags: ["auth"],
      security: [],
      requestBody: { required: true, ...json(jsonSchemaOf(otpRequestSchema, "input")) },
      responses: {
        202: {
          description: "Code sent — nothing else about the account is revealed.",
          ...json(jsonSchemaOf(otpRequestResponseSchema, "output")),
        },
        429: errorResponse("Too many requests for this identifier; wait and retry."),
      },
    },
  },
  "/auth/otp/verify": {
    post: {
      operationId: "auth.otpVerify",
      summary: "Verify an OTP",
      description:
        "Customer login step 2. Verifies the code, activates a TEMP customer, and returns a token pair for the portal.",
      tags: ["auth"],
      security: [],
      requestBody: { required: true, ...json(jsonSchemaOf(otpVerifySchema, "input")) },
      responses: {
        200: {
          description: "Signed in.",
          ...json(jsonSchemaOf(otpVerifyResponseSchema, "output")),
        },
        400: errorResponse("The code is wrong, expired, or over the attempt limit."),
      },
    },
  },
  "/auth/me": {
    get: {
      operationId: "auth.me",
      summary: "Current identity",
      description:
        "Returns the signed-in actor — staff, rider, or customer — with the permissions and scope the server resolved for this token.",
      tags: ["auth"],
      security: bearerSecurity,
      responses: {
        200: {
          description: "The current actor.",
          ...json(jsonSchemaOf(meResponseSchema, "output")),
        },
        401: unauth,
      },
    },
  },
  "/auth/logout": {
    post: {
      operationId: "auth.logout",
      summary: "Logout",
      description:
        "Acknowledges a client-side logout. Access tokens are short-lived and stateless, so the client discards its refresh token; no server-side revocation is performed.",
      tags: ["auth"],
      security: bearerSecurity,
      responses: {
        200: { description: "Acknowledged.", ...json(jsonSchemaOf(okResponseSchema, "output")) },
        401: unauth,
      },
    },
  },
} as const

export const authTags = [
  { name: "auth", description: "Sessions, login, and the current identity." },
]
