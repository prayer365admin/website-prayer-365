import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
import {
  mapConsent,
  ConsentOutput,
  VoiceProfileListItem,
  VoiceProfileDetail,
  VoiceProfileListQuery,
} from '@/models/voice'

/*
 * Voice submission + review adapters (Tasks 35-38).
 *
 * Discipline: reads are scoped by a resolved churchIds set OR by the user's
 * own identity (submitted_by === userId). State transitions are transactional
 * — business row + audit (+ outbox on approval) commit atomically. Approval
 * only ENQUEUES the voice.register outbox job; the ElevenLabs call belongs to
 * the register worker. provider_voice_id is returned on the central detail only.
 *
 * Concurrency: VoiceProfile.version bumps on each state transition; the client
 * must supply the current version or the write returns 409 STALE_VERSION.
 */

const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Voice submission not found.',
  })

const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This submission has changed. Refresh and try again.',
  })

// Same value the seed and central pastor assignment use.
export const CONSENT_PURPOSE = 'voice_cloning'
export const VOICE_PROVIDER = 'elevenlabs'

/** Churches the linked pastor is assigned to → the OWN-submission scope. */
export const RESOLVE_OWN_SCOPE = async ({
  userId,
}: {
  userId: string
}): Promise<{ anchorChurchId: string | null; churchIds: Set<string> }> => {
  const pastor = await db.pastor.findUnique({ where: { user_id: userId }, select: { id: true } })
  if (!pastor) return { anchorChurchId: null, churchIds: new Set() }
  const rows = await db.churchPastor.findMany({
    where: { pastor_id: pastor.id },
    select: { church_id: true },
  })
  const churchIds = new Set(rows.map((r) => r.church_id))
  return { anchorChurchId: rows[0]?.church_id ?? null, churchIds }
}

/** Generic media asset read (used for evidence + sample validation / review). */
export const GET_ASSET = async ({
  assetId,
}: {
  assetId: string
}): Promise<{
  id: string
  church_id: string
  purpose: string
  status: string
  uploaded_by: string | null
  object_key: string
  mime_type: string
  checksum: string | null
} | null> =>
  db.mediaAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      church_id: true,
      purpose: true,
      status: true,
      uploaded_by: true,
      object_key: true,
      mime_type: true,
      checksum: true,
    },
  })

export const GET_CONSENT = async ({
  consentId,
}: {
  consentId: string
}): Promise<{
  id: string
  pastor_id: string | null
  user_id: string | null
  purpose: string
  terms_version: string
  recorded_at: Date
  evidence_asset_id: string | null
  revoked_at: Date | null
} | null> =>
  db.consent.findUnique({
    where: { id: consentId },
    select: {
      id: true,
      pastor_id: true,
      user_id: true,
      purpose: true,
      terms_version: true,
      recorded_at: true,
      evidence_asset_id: true,
      revoked_at: true,
    },
  })

export const GET_CONSENT_OUTPUT = async ({ consentId }: { consentId: string }) =>
  db.consent.findUnique({
    where: { id: consentId },
    select: {
      id: true,
      pastor_id: true,
      user_id: true,
      purpose: true,
      terms_version: true,
      recorded_at: true,
      evidence_asset_id: true,
      revoked_at: true,
    },
  })

export const CREATE_CONSENT = (
  data: Prisma.ConsentUncheckedCreateInput,
  tx: Prisma.TransactionClient,
) => tx.consent.create({ data })

/** Insert the audit row for a voice action inside the caller's transaction. */
export const AUDIT_VOICE = (
  tx: Prisma.TransactionClient,
  {
    actorId,
    churchId,
    action,
    resourceId,
    requestId,
  }: {
    actorId: string
    churchId: string
    action: string
    resourceId: string
    requestId: string
  },
) =>
  tx.auditLog.create({
    data: auditPayload({
      actorId,
      churchId,
      action,
      resourceType: 'voice_profile',
      resourceId,
      outcome: 'success',
      requestId,
    }),
  })

/** Relations every voice-profile DTO is built from. */
const PROFILE_INCLUDE = {
  pastor: { select: { name: true, user_id: true } },
  church: { select: { name: true } },
  consent: {
    select: { revoked_at: true, terms_version: true, recorded_at: true, evidence_asset_id: true },
  },
  samples: {
    orderBy: { position: 'asc' },
    include: {
      asset: {
        select: {
          id: true,
          church_id: true,
          purpose: true,
          status: true,
          uploaded_by: true,
          mime_type: true,
          byte_size: true,
          checksum: true,
        },
      },
    },
  },
} satisfies Prisma.VoiceProfileInclude

export type VoiceProfileRow = Prisma.VoiceProfileGetPayload<{ include: typeof PROFILE_INCLUDE }>

/** Read a profile inside the caller's transaction (for race-safe review checks). */
export const GET_PROFILE_IN_TX = (tx: Prisma.TransactionClient, profileId: string) =>
  tx.voiceProfile.findUnique({ where: { id: profileId }, include: PROFILE_INCLUDE })

export const GET_VOICE_PROFILE = async ({ profileId }: { profileId: string }) =>
  db.voiceProfile.findUnique({ where: { id: profileId }, include: PROFILE_INCLUDE })

/** The pastor ↔ church assignment a submission must belong to. */
export const GET_CHURCH_PASTOR = ({ churchId, pastorId }: { churchId: string; pastorId: string }) =>
  db.churchPastor.findUnique({
    where: { church_id_pastor_id: { church_id: churchId, pastor_id: pastorId } },
    select: { church_id: true },
  })

const listItemFromRow = (p: VoiceProfileRow): VoiceProfileListItem => ({
  id: p.id,
  pastorId: p.pastor_id,
  pastorName: p.pastor.name,
  churchId: p.church_id,
  churchName: p.church.name,
  version: p.version,
  provider: p.provider,
  reviewState: p.review_state,
  registrationState: p.registration_state,
  submittedAt: p.submitted_at ? p.submitted_at.toISOString() : null,
  reviewedAt: p.reviewed_at ? p.reviewed_at.toISOString() : null,
  reviewReason: p.review_reason,
  consentRevokedAt: p.consent.revoked_at ? p.consent.revoked_at.toISOString() : null,
  replacesProfileId: p.replaces_profile_id,
  requiresVerification: p.requires_verification,
  lastErrorCode: p.last_error_code,
  samples: p.samples.map((s) => ({
    assetId: s.asset_id,
    position: s.position,
    mimeType: s.asset.mime_type,
    byteSize: Number(s.asset.byte_size),
    checksum: s.checksum,
  })),
  createdAt: p.created_at.toISOString(),
})

/** List the caller's OWN submissions (submitted_by === userId) w/ pagination. */
export const LIST_OWN_PROFILES = async ({
  userId,
  churchIds,
  page,
  limit,
}: {
  userId: string
  churchIds: Set<string>
  page: number
  limit: number
}): Promise<{ result: VoiceProfileListItem[]; total: number }> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return { result: [], total: 0 }
  const where: Prisma.VoiceProfileWhereInput = {
    submitted_by: userId,
    church_id: { in: ids },
  }
  const [total, rows] = await db.$transaction([
    db.voiceProfile.count({ where }),
    db.voiceProfile.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      include: PROFILE_INCLUDE,
    }),
  ])
  return { result: rows.map(listItemFromRow), total }
}

/** Central review list w/ registration state. */
export const LIST_CENTRAL_PROFILES = async ({
  query,
}: {
  query: VoiceProfileListQuery
}): Promise<{ result: VoiceProfileListItem[]; total: number }> => {
  const where: Prisma.VoiceProfileWhereInput = {
    ...(query.review_state
      ? { review_state: query.review_state as Prisma.VoiceProfileWhereInput['review_state'] }
      : {}),
    ...(query.registration_state
      ? {
          registration_state:
            query.registration_state as Prisma.VoiceProfileWhereInput['registration_state'],
        }
      : {}),
    ...(query.churchId ? { church_id: query.churchId } : {}),
  }
  const orderByMap: Record<string, Prisma.VoiceProfileOrderByWithRelationInput[]> = {
    created_at: [{ created_at: query.order_direction }, { id: 'asc' }],
    review_state: [{ review_state: query.order_direction }, { id: 'asc' }],
    registration_state: [{ registration_state: query.order_direction }, { id: 'asc' }],
  }
  const [total, rows] = await db.$transaction([
    db.voiceProfile.count({ where }),
    db.voiceProfile.findMany({
      where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      orderBy: orderByMap[query.order_by],
      include: PROFILE_INCLUDE,
    }),
  ])
  return { result: rows.map(listItemFromRow), total }
}

export const GET_CENTRAL_PROFILE = async ({
  profileId,
}: {
  profileId: string
}): Promise<VoiceProfileDetail | null> => {
  const row = await GET_VOICE_PROFILE({ profileId })
  if (!row) return null
  return {
    ...listItemFromRow(row),
    consentId: row.consent_id,
    termsVersion: row.consent.terms_version,
    consentRecordedAt: row.consent.recorded_at.toISOString(),
    evidenceAssetId: row.consent.evidence_asset_id,
    cloningMethod: row.cloning_method,
    providerVoiceId: row.provider_voice_id,
  }
}

/** Re-fetch a profile (via db) mapped to a list item — used after writes/replays. */
export const GET_PROFILE_LIST_ITEM = async ({
  profileId,
}: {
  profileId: string
}): Promise<VoiceProfileListItem | null> => {
  const row = await GET_VOICE_PROFILE({ profileId })
  if (!row) return null
  return listItemFromRow(row)
}

const sampleRows = (sampleAssetIds: string[]) =>
  sampleAssetIds.map((asset_id, position) => ({ asset_id, position }))

/** Create draft (primitives — caller supplies tx). */
export const CREATE_DRAFT = async (
  tx: Prisma.TransactionClient,
  {
    data,
    actorId,
    requestId,
  }: {
    data: {
      pastorId: string
      churchId: string
      provider: string
      cloningMethod: string
      consentId: string
      sampleAssetIds: string[]
      replacesProfileId?: string
    }
    actorId: string
    requestId: string
  },
): Promise<VoiceProfileListItem> => {
  const created = await tx.voiceProfile.create({
    data: {
      pastor_id: data.pastorId,
      church_id: data.churchId,
      submitted_by: actorId,
      provider: data.provider,
      cloning_method: data.cloningMethod,
      consent_id: data.consentId,
      samples: { create: sampleRows(data.sampleAssetIds) },
      replaces_profile_id: data.replacesProfileId ?? null,
      review_state: 'DRAFT',
      registration_state: 'UNREGISTERED',
    },
    include: PROFILE_INCLUDE,
  })
  await AUDIT_VOICE(tx, {
    actorId,
    churchId: data.churchId,
    action: 'voice.submission.create',
    resourceId: created.id,
    requestId,
  })
  return listItemFromRow(created)
}

export const PATCH_DRAFT = async (
  tx: Prisma.TransactionClient,
  {
    profileId,
    expectedVersion,
    data,
    actorId,
    requestId,
  }: {
    profileId: string
    expectedVersion: number
    data: { sampleAssetIds?: string[]; consentId?: string; replacesProfileId?: string | null }
    actorId: string
    requestId: string
  },
): Promise<VoiceProfileListItem> => {
  const fields: Prisma.VoiceProfileUncheckedUpdateInput = {}
  if (data.consentId !== undefined) fields.consent_id = data.consentId
  if (data.replacesProfileId !== undefined) fields.replaces_profile_id = data.replacesProfileId
  const updated = await tx.voiceProfile.updateMany({
    where: {
      id: profileId,
      submitted_by: actorId,
      review_state: 'DRAFT',
      version: expectedVersion,
    },
    data: { ...fields, version: { increment: 1 }, updated_at: new Date() },
  })
  if (updated.count === 0) throw stale()
  if (data.sampleAssetIds !== undefined) {
    // Draft only: the whole list is replaced, order = position.
    await tx.voiceProfileSample.deleteMany({ where: { voice_profile_id: profileId } })
    await tx.voiceProfileSample.createMany({
      data: sampleRows(data.sampleAssetIds).map((r) => ({ ...r, voice_profile_id: profileId })),
    })
  }
  const row = await GET_PROFILE_IN_TX(tx, profileId)
  if (!row) throw notFound()
  await AUDIT_VOICE(tx, {
    actorId,
    churchId: row.church_id,
    action: 'voice.submission.update',
    resourceId: profileId,
    requestId,
  })
  return listItemFromRow(row)
}

/** Submit: freeze each sample's checksum + submitted_at, state SUBMITTED (immutable). */
export const SUBMIT_FREEZE = async (
  tx: Prisma.TransactionClient,
  {
    profileId,
    expectedVersion,
    checksums,
    actorId,
    requestId,
  }: {
    profileId: string
    expectedVersion: number
    checksums: { position: number; checksum: string }[]
    actorId: string
    requestId: string
  },
): Promise<VoiceProfileListItem> => {
  const updated = await tx.voiceProfile.updateMany({
    where: {
      id: profileId,
      submitted_by: actorId,
      review_state: 'DRAFT',
      version: expectedVersion,
    },
    data: {
      review_state: 'SUBMITTED',
      submitted_at: new Date(),
      version: { increment: 1 },
      updated_at: new Date(),
    },
  })
  if (updated.count === 0) throw stale()
  for (const { position, checksum } of checksums) {
    await tx.voiceProfileSample.update({
      where: { voice_profile_id_position: { voice_profile_id: profileId, position } },
      data: { checksum },
    })
  }
  const row = await GET_PROFILE_IN_TX(tx, profileId)
  if (!row) throw notFound()
  await AUDIT_VOICE(tx, {
    actorId,
    churchId: row.church_id,
    action: 'voice.submission.submit',
    resourceId: profileId,
    requestId,
  })
  return listItemFromRow(row)
}

/**
 * Approve — atomic review update + unique voice.register outbox job (idempotent
 * upsert on the unique dedupe_key so a concurrent duplicate cannot double-enqueue).
 * Caller must have pre-validated state, consent, and no-self-approval.
 */
export const REVIEW_APPROVE = async (
  tx: Prisma.TransactionClient,
  {
    profileId,
    actorId,
    versionAtApproval,
    requestId,
  }: {
    profileId: string
    actorId: string
    versionAtApproval: number
    requestId: string
  },
): Promise<VoiceProfileListItem> => {
  const updated = await tx.voiceProfile.updateMany({
    where: {
      id: profileId,
      review_state: 'SUBMITTED',
      registration_state: { not: 'DISABLED' },
      version: versionAtApproval,
    },
    data: {
      review_state: 'APPROVED',
      reviewed_by: actorId,
      reviewed_at: new Date(),
      registration_state: 'QUEUED',
      version: { increment: 1 },
      updated_at: new Date(),
    },
  })
  if (updated.count === 0) throw stale()
  // SPEC §9.3.1 dedupe key; kind matches the audio.generate naming (F4VO V1).
  const dedupeKey = `voice-register:${profileId}:${versionAtApproval}`
  await tx.outboxJob.upsert({
    where: { dedupe_key: dedupeKey },
    create: {
      kind: 'voice.register',
      dedupe_key: dedupeKey,
      resource_id: profileId,
      payload: { voiceProfileId: profileId, version: versionAtApproval },
      available_at: new Date(),
    },
    update: {},
  })
  const row = await GET_PROFILE_IN_TX(tx, profileId)
  if (!row) throw notFound()
  await AUDIT_VOICE(tx, {
    actorId,
    churchId: row.church_id,
    action: 'voice.profile.approve',
    resourceId: profileId,
    requestId,
  })
  return listItemFromRow(row)
}

export const REVIEW_REJECT = async (
  tx: Prisma.TransactionClient,
  {
    profileId,
    inputVersion,
    reason,
    actorId,
    requestId,
  }: {
    profileId: string
    inputVersion: number
    reason: string
    actorId: string
    requestId: string
  },
): Promise<VoiceProfileListItem> => {
  const updated = await tx.voiceProfile.updateMany({
    where: { id: profileId, review_state: 'SUBMITTED', version: inputVersion },
    data: {
      review_state: 'REJECTED',
      reviewed_by: actorId,
      reviewed_at: new Date(),
      review_reason: reason,
      version: { increment: 1 },
      updated_at: new Date(),
    },
  })
  if (updated.count === 0) throw stale()
  const row = await GET_PROFILE_IN_TX(tx, profileId)
  if (!row) throw notFound()
  await AUDIT_VOICE(tx, {
    actorId,
    churchId: row.church_id,
    action: 'voice.profile.reject',
    resourceId: profileId,
    requestId,
  })
  return listItemFromRow(row)
}

/** Unset these profiles wherever they are a pastor's active voice (F4VO V4). */
const CLEAR_ACTIVE_VOICE = (tx: Prisma.TransactionClient, profileIds: string[]) =>
  tx.churchPastor.updateMany({
    where: { active_voice_profile_id: { in: profileIds } },
    data: { active_voice_profile_id: null },
  })

export const REVIEW_DISABLE = async (
  tx: Prisma.TransactionClient,
  {
    profileId,
    inputVersion,
    actorId,
    requestId,
  }: {
    profileId: string
    inputVersion: number
    actorId: string
    requestId: string
  },
): Promise<VoiceProfileListItem> => {
  const updated = await tx.voiceProfile.updateMany({
    where: {
      id: profileId,
      review_state: 'APPROVED',
      registration_state: { not: 'DISABLED' },
      version: inputVersion,
    },
    data: { registration_state: 'DISABLED', version: { increment: 1 }, updated_at: new Date() },
  })
  if (updated.count === 0) throw stale()
  await CLEAR_ACTIVE_VOICE(tx, [profileId])
  const row = await GET_PROFILE_IN_TX(tx, profileId)
  if (!row) throw notFound()
  await AUDIT_VOICE(tx, {
    actorId,
    churchId: row.church_id,
    action: 'voice.profile.disable',
    resourceId: profileId,
    requestId,
  })
  return listItemFromRow(row)
}

/**
 * Revoke the consent behind a profile (F4VO V3): consent.revoked_at, then every
 * profile using it goes DISABLED and stops being anyone's active voice.
 */
export const REVOKE_CONSENT = async (
  tx: Prisma.TransactionClient,
  {
    profileId,
    inputVersion,
    actorId,
    requestId,
  }: {
    profileId: string
    inputVersion: number
    actorId: string
    requestId: string
  },
): Promise<VoiceProfileListItem> => {
  const target = await tx.voiceProfile.findFirst({
    where: { id: profileId, version: inputVersion },
    select: { consent_id: true, church_id: true },
  })
  if (!target) throw stale()
  const revoked = await tx.consent.updateMany({
    where: { id: target.consent_id, revoked_at: null },
    data: { revoked_at: new Date() },
  })
  if (revoked.count === 0) throw stale()
  const affected = await tx.voiceProfile.findMany({
    where: { consent_id: target.consent_id, registration_state: { not: 'DISABLED' } },
    select: { id: true },
  })
  const ids = affected.map((p) => p.id)
  await tx.voiceProfile.updateMany({
    where: { id: { in: ids } },
    data: { registration_state: 'DISABLED', version: { increment: 1 }, updated_at: new Date() },
  })
  await CLEAR_ACTIVE_VOICE(tx, ids)
  await tx.auditLog.create({
    data: auditPayload({
      actorId,
      churchId: target.church_id,
      action: 'voice.consent.revoke',
      resourceType: 'consent',
      resourceId: target.consent_id,
      outcome: 'success',
      requestId,
    }),
  })
  const row = await GET_PROFILE_IN_TX(tx, profileId)
  if (!row) throw notFound()
  return listItemFromRow(row)
}

// re-export mapConsent so controllers build consent DTO
export { mapConsent }
export type { ConsentOutput }
