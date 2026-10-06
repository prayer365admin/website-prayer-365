import { z } from 'zod'

/*
 * Voice submission + admin review DTOs (SPEC §8.3, §9.3.1; Tasks 35-38).
 *
 * Own-submission endpoints derive the pastor subject from the linked user
 * (pastors.user_id === session.user.user_id) and are confined to DRAFT edition.
 * provider_voice_id is a read-only support reference on the central detail only
 * (F4VO V2); own-submission endpoints never return it.
 */

/** Max sample files per submission (F4VO V7). ElevenLabs IVC documents no hard cap. */
export const VOICE_SAMPLE_MAX_FILES = Number(process.env.VOICE_SAMPLE_MAX_FILES ?? 5)

const SampleAssetIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(VOICE_SAMPLE_MAX_FILES)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'Duplicate sample asset.' })

// --- Task 35 — consent ------------------------------------------------------

export const VoiceConsentInputSchema = z
  .object({
    evidenceAssetId: z.string().uuid(),
    termsVersion: z.string().trim().min(1).max(50),
  })
  .strict()

export type VoiceConsentInput = z.infer<typeof VoiceConsentInputSchema>

export const ConsentOutputSchema = z.object({
  id: z.string(),
  pastorId: z.string().nullable(),
  userId: z.string().nullable(),
  purpose: z.string(),
  termsVersion: z.string(),
  recordedAt: z.string(),
  evidenceAssetId: z.string().nullable(),
  revokedAt: z.string().nullable(),
})

export type ConsentOutput = {
  id: string
  pastorId: string | null
  userId: string | null
  purpose: string
  termsVersion: string
  recordedAt: string
  evidenceAssetId: string | null
  revokedAt: string | null
}

export const mapConsent = (c: {
  id: string
  pastor_id: string | null
  user_id: string | null
  purpose: string
  terms_version: string
  recorded_at: Date
  evidence_asset_id: string | null
  revoked_at: Date | null
}): ConsentOutput => ({
  id: c.id,
  pastorId: c.pastor_id,
  userId: c.user_id,
  purpose: c.purpose,
  termsVersion: c.terms_version,
  recordedAt: c.recorded_at.toISOString(),
  evidenceAssetId: c.evidence_asset_id,
  revokedAt: c.revoked_at ? c.revoked_at.toISOString() : null,
})

// --- Task 36 — own submissions ----------------------------------------------

export const VoiceSubmissionInputSchema = z
  .object({
    sampleAssetIds: SampleAssetIdsSchema,
    consentId: z.string().uuid(),
    churchId: z.string().uuid(),
    replacesProfileId: z.string().uuid().optional(),
  })
  .strict()

export type VoiceSubmissionInput = z.infer<typeof VoiceSubmissionInputSchema>

/** PATCH own draft — ONLY own sample/consent/replaces fields. review/provider/
 * registration fields are server-forbidden and rejected by `.strict()`. */
export const VoiceSubmissionPatchSchema = z
  .object({
    version: z.number().int().positive(),
    sampleAssetIds: SampleAssetIdsSchema.optional(),
    consentId: z.string().uuid().optional(),
    replacesProfileId: z.string().uuid().nullish(),
  })
  .strict()

export type VoiceSubmissionPatch = z.infer<typeof VoiceSubmissionPatchSchema>

export const VoiceSubmitInputSchema = z
  .object({
    version: z.number().int().positive(),
  })
  .strict()

export type VoiceSubmitInput = z.infer<typeof VoiceSubmitInputSchema>

export const VoiceProfileSampleSchema = z.object({
  assetId: z.string(),
  position: z.number(),
  mimeType: z.string(),
  byteSize: z.number(),
  checksum: z.string().nullable(),
})

export type VoiceProfileSample = {
  assetId: string
  position: number
  mimeType: string
  byteSize: number
  /** Frozen at submit; null while DRAFT. */
  checksum: string | null
}

export const VoiceProfileListItemSchema = z.object({
  id: z.string(),
  pastorId: z.string(),
  pastorName: z.string(),
  churchId: z.string(),
  churchName: z.string(),
  version: z.number(),
  provider: z.string(),
  reviewState: z.string(),
  registrationState: z.string(),
  submittedAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewReason: z.string().nullable(),
  consentRevokedAt: z.string().nullable(),
  replacesProfileId: z.string().nullable(),
  requiresVerification: z.boolean().nullable(),
  lastErrorCode: z.string().nullable(),
  samples: z.array(VoiceProfileSampleSchema),
  createdAt: z.string(),
})

export type VoiceProfileListItem = {
  id: string
  pastorId: string
  pastorName: string
  churchId: string
  churchName: string
  version: number
  provider: string
  reviewState: string
  registrationState: string
  submittedAt: string | null
  reviewedAt: string | null
  reviewReason: string | null
  consentRevokedAt: string | null
  replacesProfileId: string | null
  requiresVerification: boolean | null
  lastErrorCode: string | null
  samples: VoiceProfileSample[]
  createdAt: string
}

/** Central detail — preview refs (assets via /uploads/:assetId/access) + read-only Voice ID. */
export const VoiceProfileDetailSchema = VoiceProfileListItemSchema.extend({
  consentId: z.string(),
  termsVersion: z.string(),
  consentRecordedAt: z.string(),
  evidenceAssetId: z.string().nullable(),
  cloningMethod: z.string(),
  providerVoiceId: z.string().nullable(),
})

export type VoiceProfileDetail = VoiceProfileListItem & {
  consentId: string
  termsVersion: string
  consentRecordedAt: string
  evidenceAssetId: string | null
  cloningMethod: string
  providerVoiceId: string | null
}

export const VoiceProfileListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  order_by: z.enum(['created_at', 'review_state', 'registration_state']).default('created_at'),
  order_direction: z.enum(['asc', 'desc']).default('desc'),
  review_state: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  registration_state: z
    .enum([
      'UNREGISTERED',
      'QUEUED',
      'REGISTERING',
      'VERIFICATION_REQUIRED',
      'READY',
      'FAILED',
      'REGISTRATION_UNKNOWN',
      'DISABLED',
    ])
    .optional(),
  churchId: z.string().uuid().optional(),
})

export type VoiceProfileListQuery = z.infer<typeof VoiceProfileListQuerySchema>

// --- Task 38 — review actions -----------------------------------------------

export const VoiceApproveInputSchema = z.object({ version: z.number().int().positive() }).strict()

export type VoiceApproveInput = z.infer<typeof VoiceApproveInputSchema>

export const VoiceRejectInputSchema = z
  .object({
    version: z.number().int().positive(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict()

export type VoiceRejectInput = z.infer<typeof VoiceRejectInputSchema>

/** PATCH central profile: disable it, or revoke its consent (disables every profile on it). */
export const VoiceDisableInputSchema = z
  .object({
    version: z.number().int().positive(),
    action: z.enum(['disable', 'revoke_consent']).default('disable'),
  })
  .strict()

export type VoiceDisableInput = z.infer<typeof VoiceDisableInputSchema>
