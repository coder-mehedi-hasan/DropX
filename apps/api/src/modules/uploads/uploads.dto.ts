import { z } from "zod"

/**
 * The upload contract.
 *
 * One generic route, validated against a fixed purpose vocabulary: a client
 * claims *what* it is uploading (`avatar`, `proof`, …) and the server answers
 * with the only two rules per purpose — the accepted content types and the byte
 * ceiling. Adding a destination for files is one entry in `UPLOAD_RULES`
 * below; the route itself never changes.
 */

export const UPLOAD_PURPOSES = ["avatar", "proof"] as const
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number]
export const UPLOAD_PURPOSES_INPUT = UPLOAD_PURPOSES as readonly string[]

type PurposeRules = {
  /** Object key folder, e.g. `avatars`. */
  folder: string
  allowedTypes: readonly string[]
  maxBytes: number
}

export const UPLOAD_RULES = {
  avatar: {
    folder: "avatars",
    allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
    maxBytes: 2 * 1024 * 1024,
  },
  proof: {
    folder: "proofs",
    allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
    maxBytes: 5 * 1024 * 1024,
  },
} satisfies Record<UploadPurpose, PurposeRules>

export function rulesForPurpose(purpose: string): PurposeRules | null {
  return purpose in UPLOAD_RULES ? (UPLOAD_RULES[purpose as UploadPurpose] as PurposeRules) : null
}

/** The purpose a client may send — the enum surface, open text never reaches storage. */
export const uploadPurposeSchema = z.enum(UPLOAD_PURPOSES)

/** The purpose's facet on the wire: a file whose identity is the folder. */
export const uploadPurposeParamSchema = z.object({ purpose: uploadPurposeSchema })

/** What the route returns: a public URL the caller stores, never the bytes. */
export const uploadResponseSchema = z.object({
  url: z.string(),
  key: z.string(),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
})

export type UploadResponse = z.infer<typeof uploadResponseSchema>