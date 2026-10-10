import { DomainError, ERROR_CODES } from "../../core"
import { objectKey, putObject } from "../../shared/storage/s3"
import { rulesForPurpose, type UploadPurpose, type UploadResponse } from "./uploads.dto"

/**
 * Upload rules.
 *
 * The transport hands over the parsed `File` (name, mime, bytes) and a purpose;
 * everything the route must never trust — where the bytes land, what the key
 * looks like — is decided here. The key is generated, never taken from the
 * client, so a filename cannot walk out of its folder; and the purpose gates
 * both the allowlist and the size ceiling, so a 50 MB "avatar" cannot sneak in
 * as anything but itself.
 */

const MAX_REQUEST_BYTES = 10 * 1024 * 1024

export async function uploadFile(
  purpose: UploadPurpose,
  file: File,
): Promise<UploadResponse> {
  const rules = rulesForPurpose(purpose)
  if (!rules) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, `Unknown upload purpose: ${purpose}`)
  }

  if (!rules.allowedTypes.includes(file.type)) {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      `This purpose accepts ${rules.allowedTypes.join(", ")}, not ${file.type || "an unknown type"}`,
    )
  }

  if (file.size === 0) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "The file is empty")
  }

  if (file.size > rules.maxBytes) {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      `That file is ${file.size} bytes; the limit for this purpose is ${rules.maxBytes}`,
    )
  }

  if (file.size > MAX_REQUEST_BYTES) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "That file is too large to process")
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const ext = rules.allowedTypes
    .find((type) => type === file.type)
    ?.split("/")[1] ?? "bin"

  return putObject({
    key: objectKey(rules.folder, ext),
    body: bytes,
    contentType: file.type,
  })
}