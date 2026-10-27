/* eslint-disable no-console -- this operator script reports resumable workflow progress */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { approveAudio, enqueueAudio } from '../src/controller/prayer-audio'
import {
  approveProfile,
  createSubmission,
  createVoiceConsent,
  submitSubmission,
} from '../src/controller/voice'
import { S3_PUT_OBJECT } from '../src/providers/s3'
import { db } from '../src/utils/db-connection'
import { hashBytes } from '../src/utils/hash'
import {
  VIIMSI_CHURCH_ADMIN_EMAIL,
  VIIMSI_CHURCH_NAME,
  VIIMSI_REVIEWER_EMAIL,
} from './seeds/viimsi'

const PASTOR_EMAIL = 'viimsi.pastor@example.com'
const PASTOR_NAME = 'Mikk Leedjärv'
const TERMS_VERSION = 'offline-authorization-v1'
const SOURCE_ROOT = resolve(process.cwd(), 'docs/admin/SEED-DATA')

const sourceFiles = [
  {
    filename: 'prayer-sample-1-clip-0min.mp3',
    purpose: 'VOICE_SAMPLE' as const,
    mimeType: 'audio/mpeg',
    keyPart: 'mikk-leedjarv-clip-0min.mp3',
  },
  {
    filename: 'prayer-sample-1-clip-6min.mp3',
    purpose: 'VOICE_SAMPLE' as const,
    mimeType: 'audio/mpeg',
    keyPart: 'mikk-leedjarv-clip-6min.mp3',
  },
  {
    filename: 'prayer-sample-1-clip-12min.mp3',
    purpose: 'VOICE_SAMPLE' as const,
    mimeType: 'audio/mpeg',
    keyPart: 'mikk-leedjarv-clip-12min.mp3',
  },
  {
    filename: 'evidence.png',
    purpose: 'CONSENT_EVIDENCE' as const,
    mimeType: 'image/png',
    keyPart: 'mikk-leedjarv-client-approval.png',
  },
]

const context = async () => {
  const [church, pastorUser, reviewer, churchAdmin, pastor] = await Promise.all([
    db.church.findFirst({ where: { name: VIIMSI_CHURCH_NAME } }),
    db.user.findUnique({ where: { email: PASTOR_EMAIL } }),
    db.user.findUnique({ where: { email: VIIMSI_REVIEWER_EMAIL } }),
    db.user.findUnique({ where: { email: VIIMSI_CHURCH_ADMIN_EMAIL } }),
    db.pastor.findFirst({ where: { name: PASTOR_NAME } }),
  ])
  if (!church || !pastorUser || !reviewer || !churchAdmin || !pastor) {
    throw new Error('Run the general seed and seed:viimsi before this workflow.')
  }
  if (pastor.user_id !== pastorUser.id) {
    throw new Error('The dedicated Viimsi pastor account is not linked to Mikk Leedjärv.')
  }
  return { church, pastorUser, reviewer, churchAdmin, pastor }
}

const storeSourceAsset = async ({
  churchId,
  uploadedBy,
  filename,
  purpose,
  mimeType,
  keyPart,
}: {
  churchId: string
  uploadedBy: string
  filename: string
  purpose: 'VOICE_SAMPLE' | 'CONSENT_EVIDENCE'
  mimeType: string
  keyPart: string
}) => {
  const bytes = await readFile(resolve(SOURCE_ROOT, filename))
  const checksum = hashBytes(bytes)
  const objectKey = `media/${churchId}/${purpose.toLowerCase()}/${keyPart}`
  const existing = await db.mediaAsset.findUnique({ where: { object_key: objectKey } })

  if (existing?.checksum && existing.checksum !== checksum) {
    const inUse =
      (await db.voiceProfileSample.count({ where: { asset_id: existing.id } })) > 0 ||
      (await db.consent.count({ where: { evidence_asset_id: existing.id } })) > 0
    if (inUse) {
      throw new Error(`Refusing to replace frozen voice workflow asset ${filename}.`)
    }
  }

  await S3_PUT_OBJECT({ key: objectKey, body: bytes, contentType: mimeType })
  return db.mediaAsset.upsert({
    where: { object_key: objectKey },
    update: {
      church_id: churchId,
      purpose,
      mime_type: mimeType,
      byte_size: BigInt(bytes.byteLength),
      checksum,
      status: 'READY',
      uploaded_by: uploadedBy,
    },
    create: {
      church_id: churchId,
      object_key: objectKey,
      purpose,
      mime_type: mimeType,
      byte_size: BigInt(bytes.byteLength),
      checksum,
      status: 'READY',
      uploaded_by: uploadedBy,
    },
  })
}

const prepareVoice = async () => {
  const { church, pastorUser, reviewer, pastor } = await context()
  const existingProfile = await db.voiceProfile.findFirst({
    where: { church_id: church.id, pastor_id: pastor.id, registration_state: { not: 'DISABLED' } },
    orderBy: { created_at: 'desc' },
  })

  if (existingProfile) {
    console.log(
      `[viimsi-voice] existing profile ${existingProfile.id}: ${existingProfile.review_state}/${existingProfile.registration_state}`,
    )
    return existingProfile
  }

  const assets = []
  for (const source of sourceFiles) {
    assets.push(
      await storeSourceAsset({
        churchId: church.id,
        uploadedBy: pastorUser.id,
        ...source,
      }),
    )
  }
  const evidence = assets.find((asset) => asset.purpose === 'CONSENT_EVIDENCE')
  const samples = assets.filter((asset) => asset.purpose === 'VOICE_SAMPLE')
  if (!evidence || samples.length !== 3) throw new Error('Voice source assets are incomplete.')

  const consent = await createVoiceConsent({
    userId: pastorUser.id,
    churchIds: new Set([church.id]),
    input: { evidenceAssetId: evidence.id, termsVersion: TERMS_VERSION },
    idempotencyKey: `viimsi-mikk-consent:${evidence.id}`,
    requestId: crypto.randomUUID(),
  })
  const draft = await createSubmission({
    userId: pastorUser.id,
    churchIds: new Set([church.id]),
    input: {
      churchId: church.id,
      consentId: consent.id,
      sampleAssetIds: samples.map((asset) => asset.id),
    },
    idempotencyKey: `viimsi-mikk-voice:${consent.id}`,
    requestId: crypto.randomUUID(),
  })
  const submitted = await submitSubmission({
    userId: pastorUser.id,
    profileId: draft.id,
    input: { version: draft.version },
    idempotencyKey: `viimsi-mikk-submit:${draft.id}`,
    requestId: crypto.randomUUID(),
  })
  const approved = await approveProfile({
    userId: reviewer.id,
    profileId: submitted.id,
    input: { version: submitted.version },
    idempotencyKey: `viimsi-mikk-approve:${submitted.id}`,
    requestId: crypto.randomUUID(),
  })
  console.log(
    `[viimsi-voice] profile ${approved.id} submitted by ${PASTOR_EMAIL} and approved by ${VIIMSI_REVIEWER_EMAIL}`,
  )
  return approved
}

const readyVoice = async () => {
  const { church, pastor } = await context()
  const profile = await db.voiceProfile.findFirst({
    where: {
      church_id: church.id,
      pastor_id: pastor.id,
      review_state: 'APPROVED',
      registration_state: 'READY',
      provider_voice_id: { not: null },
      consent: { revoked_at: null },
    },
    orderBy: { created_at: 'desc' },
  })
  if (!profile) throw new Error('Mikk Leedjärv voice profile is not READY yet.')
  return profile
}

const enqueueAllAudio = async () => {
  const { church, churchAdmin } = await context()
  const voice = await readyVoice()
  const prayers = await db.prayer.findMany({
    where: {
      church_id: church.id,
      current_version_id: { not: null },
      published_version_id: { not: null },
    },
    include: { versions: true },
    orderBy: { published_at: 'asc' },
  })
  let queued = 0
  let skipped = 0

  for (const prayer of prayers) {
    const version = prayer.versions.find((item) => item.id === prayer.current_version_id)
    if (!version) throw new Error(`Prayer ${prayer.id} has no current version.`)
    const existing = await db.prayerAudio.findFirst({
      where: {
        prayer_version_id: version.id,
        voice_profile_id: voice.id,
        status: { in: ['QUEUED', 'GENERATING', 'READY', 'APPROVED'] },
      },
    })
    if (existing) {
      skipped++
      continue
    }
    const failedAttempts = await db.prayerAudio.count({
      where: {
        prayer_version_id: version.id,
        voice_profile_id: voice.id,
        status: 'FAILED',
      },
    })
    await enqueueAudio({
      userId: churchAdmin.id,
      churchId: church.id,
      churchIds: new Set([church.id]),
      prayerId: prayer.id,
      input: {
        version: prayer.version,
        prayerVersionId: version.id,
        voiceProfileId: voice.id,
      },
      idempotencyKey: `viimsi-audio:${version.id}:${voice.id}:${failedAttempts + 1}`,
      requestId: crypto.randomUUID(),
    })
    queued++
  }
  console.log(`[viimsi-audio] queued ${queued}; skipped existing ${skipped}`)
}

const approveReadyAudio = async () => {
  const { church, reviewer } = await context()
  const prayers = await db.prayer.findMany({
    where: {
      church_id: church.id,
      current_version_id: { not: null },
      published_version_id: { not: null },
    },
    include: { versions: { include: { audio: true } } },
  })
  let approved = 0
  let waiting = 0

  for (const prayer of prayers) {
    const version = prayer.versions.find((item) => item.id === prayer.current_version_id)
    const audio = version?.audio.find((item) => item.status === 'READY')
    if (!version || !audio) {
      if (!version?.audio.some((item) => item.status === 'APPROVED')) waiting++
      continue
    }
    await approveAudio({
      userId: reviewer.id,
      churchId: church.id,
      churchIds: new Set([church.id]),
      prayerId: prayer.id,
      audioId: audio.id,
      input: { version: prayer.version, prayerVersionId: version.id },
      requestId: crypto.randomUUID(),
    })
    approved++
  }
  console.log(`[viimsi-audio] approved ${approved}; waiting ${waiting}`)
}

const showStatus = async () => {
  const { church, pastor } = await context()
  const profile = await db.voiceProfile.findFirst({
    where: { church_id: church.id, pastor_id: pastor.id },
    orderBy: { created_at: 'desc' },
  })
  const audio = await db.prayerAudio.groupBy({
    by: ['status'],
    where: { verse: { prayer: { church_id: church.id } } },
    _count: { _all: true },
  })
  console.log(
    JSON.stringify(
      {
        voice: profile
          ? {
              id: profile.id,
              reviewState: profile.review_state,
              registrationState: profile.registration_state,
              hasProviderVoiceId: Boolean(profile.provider_voice_id),
              lastErrorCode: profile.last_error_code,
            }
          : null,
        audio: Object.fromEntries(audio.map((row) => [row.status, row._count._all])),
      },
      null,
      2,
    ),
  )
}

const main = async () => {
  const command = process.argv[2]
  if (command === 'prepare-voice') await prepareVoice()
  else if (command === 'enqueue-audio') await enqueueAllAudio()
  else if (command === 'approve-audio') await approveReadyAudio()
  else if (command === 'status') await showStatus()
  else throw new Error('Use prepare-voice, enqueue-audio, approve-audio, or status.')
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exitCode = 1
  })
