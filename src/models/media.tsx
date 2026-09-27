import { z } from 'zod'

/*
 * Media DTOs (SPEC §8.2 media endpoints, §9.3.1, §10.4 / Task 33).
 *
 * purpose allowlist + size/type constraints: GENERATED_AUDIO is worker-created
 * (client uploads reject it here); the remaining three purposes map to either
 * `prayer_media` (IMAGE) or `prayer_voice_submission` (VOICE_SAMPLE /
 * CONSENT_EVIDENCE) permission in the controller. The registered OpenAPI body
 * is a PLAIN z.object (per the foundation rule: no .refine/.transform wrapper
 * for registered schemas); MIME/size constraints are enforced in the
 * controller via MEDIA_TYPE_ALLOWLIST so the spec stays clean.
 */

export const MediaPurposeSchema = z.enum([
  'IMAGE',
  'VOICE_SAMPLE',
  'CONSENT_EVIDENCE',
  'GENERATED_AUDIO',
])
export type MediaPurpose = z.infer<typeof MediaPurposeSchema>

/** Purposes a client may request an upload for (GENERATED_AUDIO is worker-only). */
export const ClientUploadPurposeSchema = z.enum(['IMAGE', 'VOICE_SAMPLE', 'CONSENT_EVIDENCE'])
export type ClientUploadPurpose = z.infer<typeof ClientUploadPurposeSchema>

export const MediaStatusSchema = z.enum(['PENDING', 'READY', 'REJECTED'])
export type MediaStatus = z.infer<typeof MediaStatusSchema>

export const MediaUploadInputSchema = z
  .object({
    purpose: ClientUploadPurposeSchema,
    mimeType: z.string().trim().min(1).max(100),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(200 * 1024 * 1024),
  })
  .strict()
export type MediaUploadInput = z.infer<typeof MediaUploadInputSchema>

/** Global /uploads request body — churchId is the entity context (SPEC §10.4). */
export const MediaUploadBodySchema = z
  .object({
    churchId: z.string().min(1),
    purpose: ClientUploadPurposeSchema,
    mimeType: z.string().trim().min(1).max(100),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(200 * 1024 * 1024),
  })
  .strict()
export type MediaUploadBody = z.infer<typeof MediaUploadBodySchema>

/** Purpose → allowed MIME types + byte cap (SPEC §10.4 step 2, D12 limits). */
export const MEDIA_TYPE_ALLOWLIST: Record<MediaPurpose, { mimeTypes: string[]; maxBytes: number }> =
  {
    IMAGE: { mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 10 * 1024 * 1024 },
    VOICE_SAMPLE: {
      mimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm'],
      maxBytes: 25 * 1024 * 1024,
    },
    CONSENT_EVIDENCE: {
      mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      maxBytes: 10 * 1024 * 1024,
    },
    GENERATED_AUDIO: {
      mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav'],
      maxBytes: 50 * 1024 * 1024,
    },
  }

export const MediaUploadOutputSchema = z.object({
  assetId: z.string(),
  objectKey: z.string(),
  uploadUrl: z.string(),
  fields: z.record(z.string(), z.string()),
  expiresIn: z.number(),
})
export type MediaUploadOutput = z.infer<typeof MediaUploadOutputSchema>

export const MediaCompleteInputSchema = z
  .object({
    checksum: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/i, 'checksum must be a sha256 hex digest'),
  })
  .strict()
export type MediaCompleteInput = z.infer<typeof MediaCompleteInputSchema>

/** Global complete request body — churchId (entity context) + checksum. */
export const MediaCompleteBodySchema = z
  .object({
    churchId: z.string().min(1),
    checksum: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/i, 'checksum must be a sha256 hex digest'),
  })
  .strict()

export const MediaAssetOutputSchema = z.object({
  id: z.string(),
  churchId: z.string(),
  purpose: MediaPurposeSchema,
  mimeType: z.string(),
  byteSize: z.number(),
  checksum: z.string().nullable(),
  status: MediaStatusSchema,
  uploadedBy: z.string().nullable(),
  objectKey: z.string(),
  createdAt: z.string(),
})
export type MediaAssetOutput = z.infer<typeof MediaAssetOutputSchema>

export const mapMediaAsset = (a: {
  id: string
  church_id: string
  purpose: string
  mime_type: string
  byte_size: bigint
  checksum: string | null
  status: string
  uploaded_by: string | null
  object_key: string
  created_at: Date
}): MediaAssetOutput => ({
  id: a.id,
  churchId: a.church_id,
  purpose: a.purpose as MediaPurpose,
  mimeType: a.mime_type,
  byteSize: Number(a.byte_size),
  checksum: a.checksum,
  status: a.status as MediaStatus,
  uploadedBy: a.uploaded_by,
  objectKey: a.object_key,
  createdAt: a.created_at.toISOString(),
})

export const MediaAccessOutputSchema = z.object({
  assetId: z.string(),
  purpose: MediaPurposeSchema,
  mimeType: z.string(),
  byteSize: z.number(),
  status: MediaStatusSchema,
  url: z.string(),
  expiresIn: z.number(),
})
export type MediaAccessOutput = z.infer<typeof MediaAccessOutputSchema>

export const MediaCompleteOutputSchema = z.object({
  id: z.string(),
  status: MediaStatusSchema,
  checksum: z.string(),
})
export type MediaCompleteOutput = z.infer<typeof MediaCompleteOutputSchema>
