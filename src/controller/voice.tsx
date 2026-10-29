import { dbTransaction } from '@/utils/db-transaction'
import { GeneralError } from '@/utils/general-error'
import { withIdempotency } from '@/utils/idempotency'
import { auditPayload } from '@/utils/audit'
import { GET_PASTOR_BY_USER_ID } from '@/providers/pastor'
import {
  CONSENT_PURPOSE,
  VOICE_PROVIDER,
  CREATE_CONSENT,
  CREATE_DRAFT,
  GET_ASSET,
  GET_CENTRAL_PROFILE,
  GET_CHURCH_PASTOR,
  GET_CONSENT,
  GET_CONSENT_OUTPUT,
  GET_PROFILE_IN_TX,
  GET_PROFILE_LIST_ITEM,
  GET_VOICE_PROFILE,
  LIST_CENTRAL_PROFILES,
  LIST_OWN_CHURCHES,
  LIST_OWN_PROFILES,
  mapConsent,
  PATCH_DRAFT,
  REVIEW_APPROVE,
  REVIEW_DISABLE,
  REQUEST_RECLONE,
  REVIEW_REJECT,
  REVOKE_CONSENT,
  SUBMIT_FREEZE,
} from '@/providers/voice'
import {
  ConsentOutput,
  VoiceApproveInput,
  VoiceConsentInput,
  VoiceProfileDetail,
  VoiceProfileListItem,
  VoiceProfileListQuery,
  VoiceRejectInput,
  VoiceSubmissionInput,
  VoiceSubmissionPatch,
  VoiceSubmitInput,
  VOICE_RETRY_BLOCKED_ERRORS,
} from '@/models/voice'

/*
 * Voice submission + admin review business logic (Tasks 35-38; SPEC §8.3/§9.3.1).
 *
 * Own-submission endpoints derive the pastor from the linked user
 * (pastors.user_id === session.user.user_id) and are confined to the pastor's
 * DRAFT. Admin review is subject/object separated — no self-review, and
 * approval only ENQUEUES the voice.register outbox job (register worker).
 */

const scopeError = () =>
  new GeneralError({
    code: 403,
    error: 'UNAUTHORIZED',
    error_code: 'NOT_ALLOWED',
    details: 'This account is not allowed for this action.',
  })

const unlinked = () =>
  new GeneralError({
    code: 403,
    error: 'UNAUTHORIZED',
    error_code: 'UNLINKED_PASTOR',
    details: 'Your account is not linked to a pastor profile.',
  })

const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Voice submission not found.',
  })

const notOwn = () =>
  new GeneralError({
    code: 403,
    error: 'UNAUTHORIZED',
    error_code: 'NOT_OWN_SUBMISSION',
    details: 'You may only manage your own voice submissions.',
  })

const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This submission has changed. Refresh and try again.',
  })

const notDraft = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'INVALID_STATE',
    details: 'Only a draft submission can be edited.',
  })

const invalidEvidence = () =>
  new GeneralError({
    code: 422,
    error: 'VALIDATION_ERROR',
    error_code: 'INVALID_EVIDENCE_ASSET',
    details: 'Evidence must be a READY consent-evidence asset you own.',
    fields: { evidenceAssetId: 'Invalid or unowned evidence asset.' },
  })

const revoked = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'CONSENT_REVOKED',
    details: 'This consent has been revoked; registration cannot proceed.',
  })

const selfApproval = () =>
  new GeneralError({
    code: 403,
    error: 'UNAUTHORIZED',
    error_code: 'SELF_APPROVAL',
    details: 'You cannot review your own voice submission.',
  })

const invalidReviewState = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'INVALID_STATE',
    details: 'This submission is not in a state that allows that action.',
  })

const disabled = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'PROFILE_DISABLED',
    details: 'This voice profile is disabled and cannot be registered.',
  })

const invalidAsset = (field: string, msg: string) =>
  new GeneralError({
    code: 422,
    error: 'VALIDATION_ERROR',
    error_code: 'INVALID_MEDIA_ASSET',
    details: msg,
    fields: { [field]: msg },
  })

/** Submitter or the linked pastor may never review their own submission. */
const isSelfReview = (
  profile: { submitted_by: string; pastor: { user_id: string | null } },
  userId: string,
) => profile.submitted_by === userId || profile.pastor.user_id === userId

/** Resolve the linked pastor for the caller. */
const resolvePastor = async (userId: string) => {
  const pastor = await GET_PASTOR_BY_USER_ID({ userId })
  if (!pastor) throw unlinked()
  return pastor
}

const assertSampleAsset = async ({
  userId,
  churchIds,
  assetId,
}: {
  userId: string
  churchIds: Set<string>
  assetId: string
}) => {
  const asset = await GET_ASSET({ assetId })
  if (
    !asset ||
    asset.purpose !== 'VOICE_SAMPLE' ||
    asset.status !== 'READY' ||
    asset.uploaded_by !== userId ||
    !asset.church_id ||
    !churchIds.has(asset.church_id)
  ) {
    throw invalidAsset('sampleAssetIds', 'Invalid or unowned voice sample asset.')
  }
  return asset
}

const assertSampleAssets = async ({
  userId,
  churchIds,
  assetIds,
}: {
  userId: string
  churchIds: Set<string>
  assetIds: string[]
}) => {
  for (const assetId of assetIds) await assertSampleAsset({ userId, churchIds, assetId })
}

const assertConsent = async ({
  userId,
  pastorId,
  consentId,
}: {
  userId: string
  pastorId: string
  consentId: string
}) => {
  const consent = await GET_CONSENT({ consentId })
  if (
    !consent ||
    consent.pastor_id !== pastorId ||
    consent.user_id !== userId ||
    consent.purpose !== CONSENT_PURPOSE ||
    consent.revoked_at
  ) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'INVALID_CONSENT',
      details: "Consent must be this pastor's, unrevoked, for voice cloning.",
      fields: { consentId: 'Invalid or revoked consent.' },
    })
  }
  return consent
}

const assertReplacesProfile = async ({
  profileId,
  pastorId,
  churchId,
  replacesProfileId,
}: {
  profileId: string
  pastorId: string
  churchId: string
  replacesProfileId: string
}) => {
  const target = await GET_VOICE_PROFILE({ profileId: replacesProfileId })
  if (
    !target ||
    target.id === profileId ||
    target.pastor_id !== pastorId ||
    target.church_id !== churchId
  ) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'INVALID_REPLACES_PROFILE',
      details: 'replacesProfileId must be another profile of this pastor at this church.',
      fields: { replacesProfileId: 'Invalid replacesProfileId.' },
    })
  }
}

// --- Task 35 — consent ------------------------------------------------------

export const createVoiceConsent = async ({
  userId,
  churchIds,
  input,
  idempotencyKey,
  requestId,
}: {
  userId: string
  churchIds: Set<string>
  input: VoiceConsentInput
  idempotencyKey?: string
  requestId: string
}): Promise<ConsentOutput> => {
  const pastor = await resolvePastor(userId)
  const asset = await GET_ASSET({ assetId: input.evidenceAssetId })
  if (!asset)
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'EVIDENCE_ASSET_NOT_FOUND',
      details: 'Evidence asset not found.',
    })
  if (
    asset.purpose !== 'CONSENT_EVIDENCE' ||
    asset.status !== 'READY' ||
    asset.uploaded_by !== userId ||
    !asset.church_id ||
    !churchIds.has(asset.church_id)
  ) {
    throw invalidEvidence()
  }
  const { resource_id } = await withIdempotency({
    actorKey: `user:${userId}`,
    operation: 'voice.consent.create',
    key: idempotencyKey ?? '',
    requestBody: input,
    run: async (tx) => {
      const consent = await CREATE_CONSENT(
        {
          user_id: userId,
          pastor_id: pastor.id,
          purpose: CONSENT_PURPOSE,
          terms_version: input.termsVersion,
          evidence_asset_id: input.evidenceAssetId,
          recorded_by: userId,
        },
        tx,
      )
      await tx.auditLog.create({
        data: auditPayload({
          actorId: userId,
          churchId: asset.church_id,
          action: 'voice.consent.create',
          resourceType: 'consent',
          resourceId: consent.id,
          outcome: 'success',
          requestId,
        }),
      })
      return consent.id
    },
  })
  const out = await GET_CONSENT_OUTPUT({ consentId: resource_id ?? '' })
  if (!out) throw notFound()
  return mapConsent(out)
}

// --- Task 36 — own submissions ----------------------------------------------

export const listOwnSubmissions = async ({
  userId,
  churchIds,
  query,
}: {
  userId: string
  churchIds: Set<string>
  query: VoiceProfileListQuery
}): Promise<{ result: VoiceProfileListItem[]; total: number }> =>
  LIST_OWN_PROFILES({ userId, churchIds, page: query.page, limit: query.limit })

/** Churches the linked pastor serves: where a voice may be submitted (church_pastors). */
export const listOwnChurches = async ({
  userId,
}: {
  userId: string
}): Promise<{ id: string; name: string }[]> => LIST_OWN_CHURCHES({ userId })

export const createSubmission = async ({
  userId,
  churchIds,
  input,
  idempotencyKey,
  requestId,
}: {
  userId: string
  churchIds: Set<string>
  input: VoiceSubmissionInput
  idempotencyKey?: string
  requestId: string
}): Promise<VoiceProfileListItem> => {
  const pastor = await resolvePastor(userId)
  if (!churchIds.has(input.churchId))
    throw new GeneralError({
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'CHURCH_NOT_ASSIGNED',
      details: 'You are not assigned to that church.',
      fields: { churchId: 'Not assigned to this church.' },
    })
  if (!(await GET_CHURCH_PASTOR({ churchId: input.churchId, pastorId: pastor.id })))
    throw new GeneralError({
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'CHURCH_NOT_ASSIGNED',
      details: 'You are not assigned as a pastor of that church.',
      fields: { churchId: 'Not assigned to this church.' },
    })
  await assertSampleAssets({ userId, churchIds, assetIds: input.sampleAssetIds })
  await assertConsent({ userId, pastorId: pastor.id, consentId: input.consentId })
  if (input.replacesProfileId) {
    await assertReplacesProfile({
      profileId: '',
      pastorId: pastor.id,
      churchId: input.churchId,
      replacesProfileId: input.replacesProfileId,
    })
  }
  const { resource_id } = await withIdempotency({
    actorKey: `user:${userId}`,
    operation: 'voice.submission.create',
    key: idempotencyKey ?? '',
    requestBody: input,
    run: async (tx) => {
      const item = await CREATE_DRAFT(tx, {
        data: {
          pastorId: pastor.id,
          churchId: input.churchId,
          provider: VOICE_PROVIDER,
          cloningMethod: 'instant',
          consentId: input.consentId,
          sampleAssetIds: input.sampleAssetIds,
          replacesProfileId: input.replacesProfileId,
        },
        actorId: userId,
        requestId,
      })
      return item.id
    },
  })
  const out = await GET_PROFILE_LIST_ITEM({ profileId: resource_id ?? '' })
  if (!out) throw notFound()
  return out
}

export const patchSubmission = async ({
  userId,
  churchIds,
  profileId,
  input,
  requestId,
}: {
  userId: string
  churchIds: Set<string>
  profileId: string
  input: VoiceSubmissionPatch
  requestId: string
}): Promise<VoiceProfileListItem> => {
  const profile = await GET_VOICE_PROFILE({ profileId })
  if (!profile) throw notFound()
  if (profile.submitted_by !== userId) throw notOwn()
  if (profile.review_state !== 'DRAFT') throw notDraft()
  if (profile.version !== input.version) throw stale()
  if (input.sampleAssetIds !== undefined)
    await assertSampleAssets({ userId, churchIds, assetIds: input.sampleAssetIds })
  if (input.consentId !== undefined)
    await assertConsent({ userId, pastorId: profile.pastor_id, consentId: input.consentId })
  if (input.replacesProfileId !== undefined && input.replacesProfileId !== null) {
    await assertReplacesProfile({
      profileId,
      pastorId: profile.pastor_id,
      churchId: profile.church_id,
      replacesProfileId: input.replacesProfileId,
    })
  }
  return dbTransaction((tx) =>
    PATCH_DRAFT(tx, {
      profileId,
      expectedVersion: input.version,
      data: {
        sampleAssetIds: input.sampleAssetIds,
        consentId: input.consentId,
        replacesProfileId: input.replacesProfileId ?? null,
      },
      actorId: userId,
      requestId,
    }),
  )
}

export const submitSubmission = async ({
  userId,
  profileId,
  input,
  idempotencyKey,
  requestId,
}: {
  userId: string
  profileId: string
  input: VoiceSubmitInput
  idempotencyKey?: string
  requestId: string
}): Promise<VoiceProfileListItem> => {
  const profile = await GET_VOICE_PROFILE({ profileId })
  if (!profile) throw notFound()
  if (profile.submitted_by !== userId) throw notOwn()
  if (profile.review_state !== 'DRAFT') throw notDraft()
  if (profile.version !== input.version) throw stale()
  if (profile.samples.length === 0)
    throw invalidAsset('sampleAssetIds', 'Add at least one voice sample before submitting.')
  const checksums: { position: number; checksum: string }[] = []
  for (const s of profile.samples) {
    if (s.asset.status !== 'READY')
      throw invalidAsset('sampleAssetIds', 'A sample asset is not ready to submit.')
    // The register worker verifies downloaded bytes against this; never fake it.
    if (!s.asset.checksum)
      throw new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'SAMPLE_CHECKSUM_MISSING',
        details: 'A sample has no verified checksum. Re-upload it and try again.',
        fields: { sampleAssetIds: 'Sample checksum missing.' },
      })
    checksums.push({ position: s.position, checksum: s.asset.checksum })
  }
  const { resource_id } = await withIdempotency({
    actorKey: `user:${userId}`,
    operation: `voice.submission.submit:${profileId}`,
    key: idempotencyKey ?? '',
    requestBody: input,
    run: async (tx) => {
      const item = await SUBMIT_FREEZE(tx, {
        profileId,
        expectedVersion: input.version,
        checksums,
        actorId: userId,
        requestId,
      })
      return item.id
    },
  })
  const out = await GET_PROFILE_LIST_ITEM({ profileId: resource_id ?? '' })
  if (!out) throw notFound()
  return out
}

// --- Task 37 — central review reads -----------------------------------------

export const listCentralProfiles = async ({
  query,
}: {
  query: VoiceProfileListQuery
}): Promise<{ result: VoiceProfileListItem[]; total: number }> => LIST_CENTRAL_PROFILES({ query })

export const getCentralProfile = async ({
  profileId,
}: {
  profileId: string
}): Promise<VoiceProfileDetail | null> => GET_CENTRAL_PROFILE({ profileId })

// --- Task 38 — approve / reject / disable -----------------------------------

export const approveProfile = async ({
  userId,
  profileId,
  input,
  idempotencyKey,
  requestId,
}: {
  userId: string
  profileId: string
  input: VoiceApproveInput
  idempotencyKey?: string
  requestId: string
}): Promise<VoiceProfileDetail> => {
  const profile = await GET_VOICE_PROFILE({ profileId })
  if (!profile) throw notFound()
  if (isSelfReview(profile, userId)) throw selfApproval()
  if (profile.registration_state === 'DISABLED') throw disabled()
  if (profile.consent.revoked_at) throw revoked()
  if (profile.review_state === 'APPROVED') {
    // Duplicate approval returns the existing registration outcome (§9.3.1).
    const existing = await GET_CENTRAL_PROFILE({ profileId })
    if (existing) return existing
  }
  if (profile.review_state !== 'SUBMITTED') throw invalidReviewState()
  if (profile.version !== input.version) throw stale()

  const { resource_id } = await withIdempotency({
    actorKey: `user:${userId}`,
    operation: `voice.profile.approve:${profileId}`,
    key: idempotencyKey ?? '',
    requestBody: input,
    run: async (tx) => {
      // Race-safe re-validate within the transaction before committing review+outbox.
      const fresh = await GET_PROFILE_IN_TX(tx, profileId)
      if (!fresh) throw notFound()
      if (fresh.consent.revoked_at) throw revoked()
      if (fresh.registration_state === 'DISABLED') throw disabled()
      if (fresh.review_state !== 'SUBMITTED') {
        if (fresh.review_state === 'APPROVED') return profileId
        throw invalidReviewState()
      }
      await REVIEW_APPROVE(tx, {
        profileId,
        actorId: userId,
        versionAtApproval: input.version,
        requestId,
      })
      return profileId
    },
  })

  const out = await GET_CENTRAL_PROFILE({ profileId: resource_id ?? '' })
  if (!out) throw notFound()
  return out
}

export const rejectProfile = async ({
  userId,
  profileId,
  input,
  requestId,
}: {
  userId: string
  profileId: string
  input: VoiceRejectInput
  requestId: string
}): Promise<VoiceProfileDetail> => {
  const profile = await GET_VOICE_PROFILE({ profileId })
  if (!profile) throw notFound()
  if (isSelfReview(profile, userId)) throw selfApproval()
  if (profile.review_state !== 'SUBMITTED') throw invalidReviewState()
  if (profile.version !== input.version) throw stale()
  await dbTransaction((tx) =>
    REVIEW_REJECT(tx, {
      profileId,
      inputVersion: input.version,
      reason: input.reason,
      actorId: userId,
      requestId,
    }),
  )
  const out = await GET_CENTRAL_PROFILE({ profileId })
  if (!out) throw notFound()
  return out
}

export const disableProfile = async ({
  userId,
  profileId,
  version,
  requestId,
}: {
  userId: string
  profileId: string
  version: number
  requestId: string
}): Promise<VoiceProfileDetail> => {
  const profile = await GET_VOICE_PROFILE({ profileId })
  if (!profile) throw notFound()
  if (profile.review_state !== 'APPROVED' || profile.registration_state === 'DISABLED')
    throw invalidReviewState()
  if (profile.version !== version) throw stale()
  await dbTransaction((tx) =>
    REVIEW_DISABLE(tx, { profileId, inputVersion: version, actorId: userId, requestId }),
  )
  const out = await GET_CENTRAL_PROFILE({ profileId })
  if (!out) throw notFound()
  return out
}

/** Revoke consent (F4VO V3): disables every profile on that consent. */
export const revokeProfileConsent = async ({
  userId,
  profileId,
  version,
  requestId,
}: {
  userId: string
  profileId: string
  version: number
  requestId: string
}): Promise<VoiceProfileDetail> => {
  const profile = await GET_VOICE_PROFILE({ profileId })
  if (!profile) throw notFound()
  if (profile.consent.revoked_at) throw revoked()
  if (profile.version !== version) throw stale()
  await dbTransaction((tx) =>
    REVOKE_CONSENT(tx, { profileId, inputVersion: version, actorId: userId, requestId }),
  )
  const out = await GET_CENTRAL_PROFILE({ profileId })
  if (!out) throw notFound()
  return out
}

/**
 * Re-run registration for a FAILED voice (F4VO): re-create one ElevenLabs no
 * longer has, or retry a fixable failure (plan limit, provider rejection…).
 * Church-scoped: super admin or that church's admin. Repeat clicks while it is
 * already registering return the current state instead of a conflict.
 */
export const recloneVoiceProfile = async ({
  userId,
  churchId,
  churchIds,
  profileId,
  idempotencyKey,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  profileId: string
  idempotencyKey?: string
  requestId: string
}): Promise<VoiceProfileListItem> => {
  if (!churchIds.has(churchId)) throw scopeError()
  const profile = await GET_VOICE_PROFILE({ profileId })
  if (!profile || profile.church_id !== churchId) throw notFound()
  if (profile.registration_state === 'DISABLED') throw disabled()
  if (profile.consent.revoked_at) throw revoked()
  if (
    profile.review_state === 'APPROVED' &&
    ['QUEUED', 'REGISTERING', 'REGISTRATION_UNKNOWN'].includes(profile.registration_state)
  ) {
    const current = await GET_PROFILE_LIST_ITEM({ profileId })
    if (current) return current
  }
  if (profile.review_state !== 'APPROVED' || profile.registration_state !== 'FAILED')
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'INVALID_STATE',
      details: 'Only a failed registration can be retried.',
    })
  if (VOICE_RETRY_BLOCKED_ERRORS.includes(profile.last_error_code ?? ''))
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'RETRY_NOT_POSSIBLE',
      details: 'A retry cannot fix this failure. The pastor needs to submit a new revision.',
    })
  const { resource_id } = await withIdempotency({
    actorKey: `user:${userId}`,
    operation: `voice.profile.reclone:${profileId}`,
    key: idempotencyKey ?? '',
    requestBody: { profileId },
    run: async (tx) => {
      await REQUEST_RECLONE(tx, { profileId, actorId: userId, requestId })
      return profileId
    },
  })
  const out = await GET_PROFILE_LIST_ITEM({ profileId: resource_id ?? '' })
  if (!out) throw notFound()
  return out
}

// keep scopeError referenced (used by tests to assert 403 mapping)
export { scopeError }
