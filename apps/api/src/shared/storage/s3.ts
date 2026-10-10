import { randomUUID } from "node:crypto"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { getConfig } from "../../config"
import { DomainError, ERROR_CODES } from "../../core"

/**
 * S3-compatible object storage.
 *
 * Every file the API accepts is written here and served back as a plain URL —
 * the API never stores bytes itself and never proxies them out, so a CDN can sit
 * in front of the bucket. The client targets any implementation of the S3 API
 * (AWS, Cloudflare R2, MinIO) via `S3_ENDPOINT`, and the URL handed to callers
 * comes from `S3_PUBLIC_URL` (or `{endpoint}/{bucket}` for path-style MinIO), so
 * wherever the bytes live, the app never guesses a host.
 *
 * Storage is optional at boot: a bucketless dev builds the client anyway. The
 * upload routes are what fail closed — they assert storage is configured before
 * touching a byte, so an unconfigured deployment cannot upload into thin air.
 */

export type StoredObject = {
  /** Public URL the client stores and the browser fetches. */
  url: string
  /** `{folder}/{id}.{ext}` — the only thing the API ever writes down. */
  key: string
  size: number
  contentType: string
}

let client: S3Client | null = null

function s3Client(): S3Client {
  const { storage } = getConfig()
  client ??= new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    forcePathStyle: storage.forcePathStyle,
    ...(storage.accessKeyId
      ? {
          credentials: {
            accessKeyId: storage.accessKeyId,
            secretAccessKey: storage.secretAccessKey ?? "",
          },
        }
      : {}),
  })
  return client
}

/** A long random key — never user input, so path traversal is structurally impossible. */
export function objectKey(folder: string, ext: string): string {
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : "bin"
  return `${folder}/${randomUUID()}.${safeExt}`
}

/** The public URL for an object, from `S3_PUBLIC_URL` or the path-style default. */
export function objectUrl(key: string): string {
  const { storage } = getConfig()
  if (storage.publicUrl) return `${storage.publicUrl.replace(/\/+$/, "")}/${key}`
  if (storage.endpoint) return `${storage.endpoint.replace(/\/+$/, "")}/${storage.bucket}/${key}`
  return `${storage.bucket}/${key}`
}

export function assertStorageEnabled(): void {
  if (!getConfig().storage.enabled) {
    throw new DomainError(
      ERROR_CODES.SERVICE_UNAVAILABLE,
      "File uploads are not configured for this deployment",
    )
  }
}

export async function putObject(input: {
  key: string
  body: Uint8Array
  contentType: string
}): Promise<StoredObject> {
  assertStorageEnabled()
  const { bucket } = getConfig().storage

  await s3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  )

  return {
    url: objectUrl(input.key),
    key: input.key,
    size: input.body.byteLength,
    contentType: input.contentType,
  }
}