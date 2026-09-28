import { sign } from "hono/jwt"

import { getConfig } from "../../config"
import type { Audience } from "./auth-context"

/**
 * Session tokens.
 *
 * The token carries identity only — **never permissions or roles**. Those are
 * loaded from the database on every request, so a revoked role or a suspended
 * user loses access immediately instead of at token expiry.
 */

/** Named so signing and verification cannot drift apart. */
export const JWT_ALGORITHM = "HS256"

export const TOKEN_TYPES = ["access", "refresh"] as const
export type TokenType = (typeof TOKEN_TYPES)[number]

export type TokenPayload = {
  /** `users.id` for staff/riders, `customers.id` for customers. */
  sub: string
  typ: TokenType
  aud: Audience
  /** Session id — lets a session be revoked as a unit. */
  sid: string
  iat?: number
  exp?: number
}

export type TokenPair = {
  accessToken: string
  refreshToken: string
  /** Seconds until the access token expires. */
  expiresIn: number
}

export async function issueTokenPair(input: {
  subject: string
  audience: Audience
  sessionId: string
}): Promise<TokenPair> {
  const { auth } = getConfig()
  const now = Math.floor(Date.now() / 1000)

  const base = {
    sub: input.subject,
    aud: input.audience,
    sid: input.sessionId,
  }

  const [accessToken, refreshToken] = await Promise.all([
    sign(
      { ...base, typ: "access", exp: now + auth.accessTokenTtl, iat: now },
      auth.secret,
      JWT_ALGORITHM,
    ),
    sign(
      { ...base, typ: "refresh", exp: now + auth.refreshTokenTtl, iat: now },
      auth.secret,
      JWT_ALGORITHM,
    ),
  ])

  return { accessToken, refreshToken, expiresIn: auth.accessTokenTtl }
}
