import { randomUUID } from 'node:crypto'
import { requiredScope } from '@/utils/required-scope'
import { GeneralError } from '@/utils/general-error'
import { db } from '@/utils/db-connection'
import { auditPayload } from '@/utils/audit'
import { CREATE_PENDING_ASSET, GET_ASSET_BY_ID_AND_CHURCH, MARK_READY } from '@/providers/media'
import { S3_HEAD_OBJECT, S3_GET_SIGNED_URL, S3_PRESIGN_UPLOAD } from '@/providers/s3'
import {
  MediaAccessOutput,
  MediaCompleteInput,
  MediaCompleteOutput,
  MediaPurpose,
  MediaUploadInput,
  MediaUploadOutput,
  MEDIA_TYPE_ALLOWLIST,
} from '@/models/media'

/*
 * Media business logic (Task 33).
 *
 * Permission is purpose-specific (SPEC §3.4 prayer_media / prayer_voice_submission,
 * §8.2 media endpoints): IMAGE (and worker GENERATED_AUDIO) use `prayer_media`;
 * VOICE_SAMPLE / CONSENT_EVIDENCE use `prayer_voice_submission`. Because the
 * purpose is not always known at the route boundary, the controller resolves
 * the authoritative scope via `requiredScope` (controllers own authorization
 * decisions; the route validates identity). S3 calls all go through the thin
 * s3 provider — the controller never touches AWS directly.
 */

const scopeError = () =>
  new GeneralError({
    code: 403,
    error: 'UNAUTHORIZED',
    error_code: 'NOT_ALLOWED',
    details: 'This account is not allowed for this church or asset.',
  })
const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Media asset not found.',
  })

const purposeSubject = (p: MediaPurpose): string =>
  p === 'IMAGE' || p === 'GENERATED_AUDIO' ? 'prayer_media' : 'prayer_voice_submission'

/** requiredScope that returns boolean (never throws) — used for optional grants. */
const canScope = async ({
  userId,
  churchId,
  subject,
  action,
}: {
  userId: string
  churchId: string
  subject: string
  action: 'read' | 'create' | 'update' | 'delete'
}): Promise<boolean> => {
  try {
    await requiredScope({ userId, churchId, subject, action })
    return true
  } catch {
    return false
  }
}

/** Assert the caller holds the scope for this purpose's subject. Returns the resolved scope. */
const assertPurposeScope = async ({
  userId,
  churchId,
  purpose,
  action,
}: {
  userId: string
  churchId: string
  purpose: MediaPurpose
  action: 'read' | 'create' | 'update'
}) => {
  const scope = await requiredScope({ userId, churchId, subject: purposeSubject(purpose), action })
  if (!scope.churchIds.has(churchId)) throw scopeError()
  return scope.churchIds
}

/** Enforce the per-purpose MIME type + byte size allowlist (SPEC §10.4 step 2). */
const assertUploadConstraints = ({
  purpose,
  mimeType,
  byteSize,
}: {
  purpose: MediaPurpose
  mimeType: string
  byteSize: number
}) => {
  const rule = MEDIA_TYPE_ALLOWLIST[purpose]
  const fields: Record<string, string> = {}
  if (!rule.mimeTypes.includes(mimeType)) {
    fields.mimeType = `MIME type is not allowed for purpose ${purpose}.`
  }
  if (byteSize > rule.maxBytes) {
    fields.byteSize = `byteSize exceeds the ${rule.maxBytes} byte cap for purpose ${purpose}.`
  }
  if (Object.keys(fields).length > 0) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'MEDIA_CONSTRAINT',
      details: 'This file does not match the allowed purpose constraints.',
      fields,
    })
  }
}

/** POST media/uploads: allocate a random key, presign, persist a PENDING asset. */
export const createUpload = async ({
  userId,
  churchId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  input: MediaUploadInput
  requestId: string
}): Promise<MediaUploadOutput> => {
  assertUploadConstraints(input)
  await assertPurposeScope({
    userId,
    churchId,
    purpose: input.purpose,
    action: 'create',
  })

  const objectKey = `media/${churchId}/${input.purpose.toLowerCase()}/${randomUUID()}`
  const { url, fields } = await S3_PRESIGN_UPLOAD({
    key: objectKey,
    contentType: input.mimeType,
    maxBytes: MEDIA_TYPE_ALLOWLIST[input.purpose].maxBytes,
  })

  const asset = await CREATE_PENDING_ASSET({
    churchId,
    purpose: input.purpose,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    objectKey,
    uploadedBy: userId,
  })
  await db.auditLog.create({
    data: auditPayload({
      actorId: userId,
      churchId,
      action: 'media.upload.initiate',
      resourceType: 'media_asset',
      resourceId: asset.id,
      outcome: 'success',
      requestId,
    }),
  })
  return { assetId: asset.id, objectKey, uploadUrl: url, fields, expiresIn: 900 }
}

/** POST media/:assetId/complete: verify object metadata/checksum → READY. */
export const completeUpload = async ({
  userId,
  churchId,
  assetId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  assetId: string
  input: MediaCompleteInput
  requestId: string
}): Promise<MediaCompleteOutput> => {
  const asset = await GET_ASSET_BY_ID_AND_CHURCH({ assetId, churchId })
  if (!asset) throw notFound()
  const purpose = asset.purpose as MediaPurpose

  const churchIds = await assertPurposeScope({ userId, churchId, purpose, action: 'update' })
  // Complete requires an owned upload (the same caller that requested it).
  if (asset.uploaded_by !== userId) throw scopeError()
  if (asset.status !== 'PENDING') {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'ASSET_NOT_PENDING',
      details: 'This asset is already completed or rejected.',
    })
  }

  let head: { contentLength: number; contentType?: string }
  try {
    head = await S3_HEAD_OBJECT({ key: asset.object_key })
  } catch {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'OBJECT_MISSING',
      details: 'The uploaded object could not be verified.',
    })
  }
  if (head.contentLength !== Number(asset.byte_size) || head.contentType !== asset.mime_type) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'OBJECT_MISMATCH',
      details: 'Uploaded object metadata does not match the requested upload.',
    })
  }

  const updated = await MARK_READY({ churchIds, assetId, checksum: input.checksum })
  if (updated.count === 0) throw notFound()
  await db.auditLog.create({
    data: auditPayload({
      actorId: userId,
      churchId,
      action: 'media.upload.complete',
      resourceType: 'media_asset',
      resourceId: assetId,
      outcome: 'success',
      requestId,
    }),
  })
  return { id: assetId, status: 'READY', checksum: input.checksum }
}

/** GET media/:assetId/access: short-lived preview URL with purpose-specific permission. */
export const getAccess = async ({
  userId,
  churchId,
  assetId,
  requestId,
}: {
  userId: string
  churchId: string
  assetId: string
  requestId: string
}): Promise<MediaAccessOutput> => {
  const asset = await GET_ASSET_BY_ID_AND_CHURCH({ assetId, churchId })
  if (!asset) throw notFound()
  const purpose = asset.purpose as MediaPurpose

  if (asset.status !== 'READY') {
    throw new GeneralError({
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'ASSET_NOT_READY',
      details: 'This asset is not ready for preview.',
    })
  }

  const isVoiceSensitive = purpose === 'VOICE_SAMPLE' || purpose === 'CONSENT_EVIDENCE'
  if (isVoiceSensitive) {
    // Voice/consent samples: voice-reviewer, OR the submitting pastor's own asset.
    const isReviewer = await canScope({
      userId,
      churchId,
      subject: 'prayer_voice_profile',
      action: 'read',
    })
    const isOwner =
      asset.uploaded_by === userId &&
      (await canScope({ userId, churchId, subject: 'prayer_voice_submission', action: 'read' }))
    if (!isReviewer && !isOwner) throw scopeError()
  } else {
    await assertPurposeScope({ userId, churchId, purpose, action: 'read' })
  }

  const url = await S3_GET_SIGNED_URL({ key: asset.object_key, expiresIn: 3600 })
  await db.auditLog.create({
    data: auditPayload({
      actorId: userId,
      churchId,
      action: 'media.access',
      resourceType: 'media_asset',
      resourceId: assetId,
      outcome: 'success',
      requestId,
    }),
  })
  return {
    assetId,
    purpose,
    mimeType: asset.mime_type,
    byteSize: Number(asset.byte_size),
    status: asset.status,
    url,
    expiresIn: 3600,
  }
}
