import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { GeneralError } from '@/utils/general-error'

/*
 * S3 adapter (Task 33). THIN provider only: presign / head / delete / get a
 * signed read URL. It never contains business rules or scoping — the media
 * controller decides those. Credentials come from process.env (AWS_* or S3_*).
 *
 * Lazy client: the S3Client is built inside the call, not at module load, so
 * importing this module never throws when env creds are absent; an S3Client
 * only starts failing once a request is actually issued (missing creds) or a
 * call requires a bucket that is not configured (S3_NOT_CONFIGURED).
 */

const notConfigured = () =>
  new GeneralError({
    code: 500,
    error: 'INTERNAL_ERROR',
    error_code: 'S3_NOT_CONFIGURED',
    details: 'Object storage is not configured.',
  })

const bucket = () =>
  process.env.AWS_S3_BUCKET ?? process.env.S3_BUCKET ?? process.env.AWS_BUCKET_NAME ?? ''
const region = () => process.env.AWS_REGION ?? process.env.S3_REGION ?? 'us-east-1'

const client = (): S3Client => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY
  return new S3Client({
    region: region(),
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  })
}

export interface PresignUploadParams {
  key: string
  contentType: string
  maxBytes: number
  expiresIn?: number
}

/** Short-lived presigned POST (fields + url) with size + content-type constraints baked in. */
export const S3_PRESIGN_UPLOAD = async ({
  key,
  contentType,
  maxBytes,
  expiresIn = 900,
}: PresignUploadParams): Promise<{ url: string; fields: Record<string, string>; key: string }> => {
  const b = bucket()
  if (!b) throw notConfigured()
  const { url, fields } = await createPresignedPost(client(), {
    Bucket: b,
    Key: key,
    Conditions: [
      ['content-length-range', 1, maxBytes],
      ['starts-with', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: expiresIn,
  })
  return { url, fields, key }
}

/** Verify the object exists and read back its size / content-type. */
export const S3_HEAD_OBJECT = async ({
  key,
}: {
  key: string
}): Promise<{ contentLength: number; contentType?: string }> => {
  const b = bucket()
  if (!b) throw notConfigured()
  const res = await client().send(new HeadObjectCommand({ Bucket: b, Key: key }))
  return { contentLength: res.ContentLength ?? 0, contentType: res.ContentType }
}

export const S3_DELETE_OBJECT = async ({ key }: { key: string }): Promise<void> => {
  const b = bucket()
  if (!b) throw notConfigured()
  await client().send(new DeleteObjectCommand({ Bucket: b, Key: key }))
}

/** Worker-side direct put (PR-07 generated audio). Returns the key + stored byte size. */
export const S3_PUT_OBJECT = async ({
  key,
  body,
  contentType,
}: {
  key: string
  body: Uint8Array
  contentType: string
}): Promise<{ key: string; byteSize: number }> => {
  const b = bucket()
  if (!b) throw notConfigured()
  await client().send(
    new PutObjectCommand({ Bucket: b, Key: key, Body: body, ContentType: contentType }),
  )
  return { key, byteSize: body.byteLength }
}

/*
 * Stable public URL for an object. Returns null when storage is not configured.
 * NOTE (temporary): the whole bucket is public-read, so every key prefix
 * (media/<churchId>/image, media/<churchId>/voice_sample, media/<churchId>/consent_evidence,
 * media/<churchId>/generated_audio, user-avatars/<userId>) yields a working URL.
 * No private media exists yet — see SPEC §10.4.1 / D13 for the pre-production revert.
 */
export const S3_PUBLIC_URL = ({ key }: { key: string }): string | null => {
  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '')
  if (base) return `${base}/${key}`
  const b = bucket()
  if (!b) return null
  return `https://${b}.s3.${region()}.amazonaws.com/${key}`
}

/** Short-lived signed GET URL for preview/download. */
export const S3_GET_SIGNED_URL = async ({
  key,
  expiresIn = 3600,
}: {
  key: string
  expiresIn?: number
}): Promise<string> => {
  const b = bucket()
  if (!b) throw notConfigured()
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: b, Key: key }), { expiresIn })
}

/** Worker-side direct read (F4VO voice.register downloads approved samples). */
export const S3_GET_OBJECT_BYTES = async ({ key }: { key: string }): Promise<Uint8Array> => {
  const b = bucket()
  if (!b) throw notConfigured()
  const res = await client().send(new GetObjectCommand({ Bucket: b, Key: key }))
  if (!res.Body) throw new Error(`S3 object ${key} has no body.`)
  return res.Body.transformToByteArray()
}
