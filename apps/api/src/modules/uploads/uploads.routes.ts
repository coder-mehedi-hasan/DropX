import { Hono } from "hono"

import { DomainError, ERROR_CODES } from "../../core"
import { response } from "../../core/http"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { uploadPurposeSchema } from "./uploads.dto"
import { uploadFile } from "./uploads.service"

/**
 * Upload transport.
 *
 * The one generic route every file-bearing feature calls: a `purpose` plus a
 * `file` in a multipart body, an object url back. Nothing here decides policy —
 * the purpose lookup owns the allowlists and sizes — and nothing trusts the
 * browser's claims, so a hand-built multipart body gets the same treatment as
 * the portal.
 */
const router = new Hono<AppEnv>()

router.post(
  "/",
  defineOperation(
    { id: "uploads.file", audience: ["admin", "riders", "web"] },
    { method: "POST", path: "/uploads" },
  ),
  async (c) => {
    const form = await c.req.formData()

    const purposeRaw = form.get("purpose")
    const purpose = typeof purposeRaw === "string" ? uploadPurposeSchema.safeParse(purposeRaw) : null

    if (!purpose || !purpose.success) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "Unknown upload purpose", {
        details: [{ field: "purpose", message: "Expected one of avatar, proof" }],
      })
    }

    const file = form.get("file")
    if (!(file instanceof File)) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "Attach a file under the `file` field")
    }

    const stored = await uploadFile(purpose.data, file)
    return c.json(response.success(stored))
  },
)

export default router