import { jsonSchemaOf } from "../schema"
import { uploadResponseSchema } from "../../modules/uploads/uploads.dto"

/**
 * `uploads` operations.
 *
 * The one multipart route in the API, so the request body cannot come from a
 * Zod schema — there is no JSON shape to validate — and this is the exception
 * to "never restate fields". The response stays generated from the DTO.
 */

const multipartBody = {
  description:
    "A file plus the purpose it is for, as `multipart/form-data`. `purpose` is one of `avatar`, `proof`; `file` is the binary upload. Per-purpose type and size limits live in `modules/uploads/uploads.dto.ts`.",
  required: true,
  content: {
    "multipart/form-data": {
      schema: {
        type: "object",
        required: ["purpose", "file"],
        properties: {
          purpose: { type: "string", enum: ["avatar", "proof"] },
          file: { type: "string", format: "binary" },
        },
      },
    },
  },
}

const json = (schema: ReturnType<typeof jsonSchemaOf>) => ({
  content: { "application/json": { schema } },
})

export const uploadsPaths = {
  "/uploads": {
    post: {
      operationId: "uploads.file",
      summary: "Upload a file",
      description:
        "Stores one file in S3-compatible storage and returns its public URL. The purpose gates both the file-type allowlist and the size ceiling; the key is server-generated so a client can never name its own object. Every app that needs a stored file (avatar, delivery proof, …) calls this and saves the returned URL.",
      tags: ["uploads"],
      requestBody: multipartBody,
      responses: {
        200: {
          description: "Stored.",
          ...json(jsonSchemaOf(uploadResponseSchema, "output")),
        },
        422: {
          description:
            "Unknown purpose, empty file, wrong content type, or over the per-purpose size limit.",
        },
        503: {
          description: "Object storage is not configured for this deployment.",
        },
      },
    },
  },
} as const

export const uploadsTags = [
  { name: "uploads", description: "Generic file upload to S3-compatible storage." },
]