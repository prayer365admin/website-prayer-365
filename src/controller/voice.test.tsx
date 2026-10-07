import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VoiceProfileDetailSchema, VoiceProfileListItemSchema } from '@/models/voice'

vi.mock('@/providers/pastor', () => ({ GET_PASTOR_BY_USER_ID: vi.fn() }))
vi.mock('@/providers/voice', () => ({
  CONSENT_PURPOSE: 'voice_cloning',
  VOICE_PROVIDER: 'elevenlabs',
  CREATE_CONSENT: vi.fn(),
  CREATE_DRAFT: vi.fn(),
  GET_ASSET: vi.fn(),
  GET_CENTRAL_PROFILE: vi.fn(),
  GET_CHURCH_PASTOR: vi.fn(),
  GET_CONSENT: vi.fn(),
  GET_CONSENT_OUTPUT: vi.fn(),
  GET_PROFILE_IN_TX: vi.fn(),
  GET_PROFILE_LIST_ITEM: vi.fn(),
  GET_VOICE_PROFILE: vi.fn(),
  LIST_CENTRAL_PROFILES: vi.fn(),
  LIST_OWN_PROFILES: vi.fn(),
  mapConsent: vi.fn((c: { id: string }) => ({ id: c.id })),
  PATCH_DRAFT: vi.fn(),
  REVIEW_APPROVE: vi.fn(),
  REVIEW_DISABLE: vi.fn(),
  REQUEST_RECLONE: vi.fn(),
  REVIEW_REJECT: vi.fn(),
  REVOKE_CONSENT: vi.fn(),
  SUBMIT_FREEZE: vi.fn(),
}))
vi.mock('@/utils/idempotency', () => ({ withIdempotency: vi.fn() }))
vi.mock('@/utils/db-transaction', () => ({ dbTransaction: vi.fn() }))

import { GET_PASTOR_BY_USER_ID } from '@/providers/pastor'
import * as voice from '@/providers/voice'
import { withIdempotency } from '@/utils/idempotency'
import { dbTransaction } from '@/utils/db-transaction'
import {
  approveProfile,
  createSubmission,
  createVoiceConsent,
  disableProfile,
  getCentralProfile,
  listCentralProfiles,
  listOwnSubmissions,
  patchSubmission,
  recloneVoiceProfile,
  rejectProfile,
  revokeProfileConsent,
  submitSubmission,
} from './voice'

const U = '00000000-0000-0000-0000-0000000000aa'
const OTHER = '00000000-0000-0000-0000-0000000000bb'
const ASSET = '00000000-0000-0000-0000-000000000001'
const CONSENT = '00000000-0000-0000-0000-000000000002'
const PROFILE = '00000000-0000-0000-0000-000000000003'
const CHURCH = '00000000-0000-0000-0000-000000000004'
const SCORE = new Set([CHURCH])

const fakeTx = { auditLog: { create: vi.fn() } }

const dbRun = (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx)

/** Make withIdempotency actually execute run(tx) and return a resource id. */
const runIdempotently = (resourceId: string) =>
  vi.mocked(withIdempotency).mockImplementation(async ({ run }) => {
    await (run as (tx: unknown) => Promise<string>)(fakeTx)
    return { fresh: true, resource_id: resourceId }
  })

const asset = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: ASSET,
  church_id: CHURCH,
  purpose: 'CONSENT_EVIDENCE',
  status: 'READY',
  uploaded_by: U,
  object_key: 'ev/obj',
  mime_type: 'image/png',
  checksum: 'abc',
  ...over,
})

const profile = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: PROFILE,
  pastor_id: 'p1',
  church_id: CHURCH,
  submitted_by: U,
  version: 1,
  provider: 'elevenlabs',
  review_state: 'DRAFT',
  registration_state: 'UNREGISTERED',
  samples: [
    {
      asset_id: ASSET,
      position: 0,
      checksum: null,
      asset: { status: 'READY', mime_type: 'audio/mpeg', checksum: 'abc' },
    },
  ],
  consent_id: CONSENT,
  consent: { revoked_at: null },
  pastor: { name: 'P', user_id: U },
  created_at: new Date(),
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('createVoiceConsent (Task 35)', () => {
  const input = { evidenceAssetId: ASSET, termsVersion: '2026-01' }

  it('records a voice-cloning consent for the linked pastor', async () => {
    vi.mocked(GET_PASTOR_BY_USER_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(voice.GET_ASSET).mockResolvedValue(asset() as never)
    runIdempotently('c1')
    vi.mocked(voice.CREATE_CONSENT).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(voice.GET_CONSENT_OUTPUT).mockResolvedValue({
      id: 'c1',
      pastor_id: 'p1',
      user_id: U,
      purpose: 'voice_cloning',
      terms_version: '2026-01',
      recorded_at: new Date(),
      evidence_asset_id: ASSET,
      revoked_at: null,
    } as never)
    const res = await createVoiceConsent({
      userId: U,
      churchIds: SCORE,
      input,
      idempotencyKey: 'k',
      requestId: 'r',
    })
    expect(voice.CREATE_CONSENT).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'voice_cloning', pastor_id: 'p1', user_id: U }),
      fakeTx,
    )
    expect(res.id).toBe('c1')
  })

  it('blocks a non-linked user (derives pastor from linked user)', async () => {
    vi.mocked(GET_PASTOR_BY_USER_ID).mockResolvedValue(null)
    await expect(
      createVoiceConsent({ userId: OTHER, churchIds: SCORE, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'UNLINKED_PASTOR' })
    expect(voice.CREATE_CONSENT).not.toHaveBeenCalled()
  })

  it('enforces evidence ownership and purpose', async () => {
    vi.mocked(GET_PASTOR_BY_USER_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(voice.GET_ASSET).mockResolvedValue(asset({ uploaded_by: OTHER }) as never)
    await expect(
      createVoiceConsent({ userId: U, churchIds: SCORE, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 422, error_code: 'INVALID_EVIDENCE_ASSET' })
  })
})

describe('submitSubmission (Task 36)', () => {
  it('freezes each sample checksum into SUBMITTED', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(profile() as never)
    runIdempotently(PROFILE)
    vi.mocked(voice.SUBMIT_FREEZE).mockResolvedValue({ id: PROFILE } as never)
    vi.mocked(voice.GET_PROFILE_LIST_ITEM).mockResolvedValue({ id: PROFILE } as never)
    await submitSubmission({
      userId: U,
      profileId: PROFILE,
      input: { version: 1 },
      idempotencyKey: 'k',
      requestId: 'r',
    })
    expect(voice.SUBMIT_FREEZE).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({
        profileId: PROFILE,
        checksums: [{ position: 0, checksum: 'abc' }],
        expectedVersion: 1,
      }),
    )
  })

  it('refuses to submit a sample without a real checksum (no object_key fallback)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({
        samples: [
          {
            asset_id: ASSET,
            position: 0,
            checksum: null,
            asset: { status: 'READY', checksum: null },
          },
        ],
      }) as never,
    )
    await expect(
      submitSubmission({ userId: U, profileId: PROFILE, input: { version: 1 }, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 422, error_code: 'SAMPLE_CHECKSUM_MISSING' })
    expect(voice.SUBMIT_FREEZE).not.toHaveBeenCalled()
  })

  it('denies a different pastor from submitting someone else’s submission', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(profile({ submitted_by: OTHER }) as never)
    await expect(
      submitSubmission({ userId: U, profileId: PROFILE, input: { version: 1 }, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'NOT_OWN_SUBMISSION' })
  })

  it('rejects submitting an already-submitted (non-draft) profile', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'SUBMITTED' }) as never,
    )
    await expect(
      submitSubmission({ userId: U, profileId: PROFILE, input: { version: 1 }, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'INVALID_STATE' })
    expect(voice.SUBMIT_FREEZE).not.toHaveBeenCalled()
  })
})

describe('patchSubmission (Task 36) — draft editable only', () => {
  const input = { version: 1, sampleAssetIds: [ASSET] }

  it('patches an own draft', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(profile() as never)
    vi.mocked(voice.GET_ASSET).mockResolvedValue(asset({ purpose: 'VOICE_SAMPLE' }) as never)
    vi.mocked(voice.PATCH_DRAFT).mockResolvedValue({ id: PROFILE } as never)
    vi.mocked(dbTransaction).mockImplementation(dbRun as never)
    await patchSubmission({
      userId: U,
      churchIds: SCORE,
      profileId: PROFILE,
      input,
      requestId: 'r',
    })
    expect(voice.PATCH_DRAFT).toHaveBeenCalled()
  })

  it('denies patching a non-draft (draft editable ONLY)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'SUBMITTED' }) as never,
    )
    await expect(
      patchSubmission({ userId: U, churchIds: SCORE, profileId: PROFILE, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'INVALID_STATE' })
  })

  it('denies a different pastor from editing someone else’s draft', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(profile({ submitted_by: OTHER }) as never)
    await expect(
      patchSubmission({ userId: U, churchIds: SCORE, profileId: PROFILE, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'NOT_OWN_SUBMISSION' })
  })
})

describe('approveProfile (Task 38)', () => {
  const action = { version: 2 }

  it('denies self-approval (approver is the submitter)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'SUBMITTED', submitted_by: U }) as never,
    )
    await expect(
      approveProfile({ userId: U, profileId: PROFILE, input: action as never, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'SELF_APPROVAL' })
    expect(withIdempotency).not.toHaveBeenCalled()
  })

  it('denies self-approval (approver is the linked pastor)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({
        review_state: 'SUBMITTED',
        submitted_by: OTHER,
        pastor: { name: 'P', user_id: U },
      }) as never,
    )
    await expect(
      approveProfile({ userId: U, profileId: PROFILE, input: action as never, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'SELF_APPROVAL' })
  })

  it('blocks approval when consent is revoked', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'SUBMITTED', consent: { revoked_at: new Date() } }) as never,
    )
    await expect(
      approveProfile({
        userId: OTHER,
        profileId: PROFILE,
        input: action as never,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'CONSENT_REVOKED' })
    expect(withIdempotency).not.toHaveBeenCalled()
  })

  it('denies approving a revision that changed since review (stale version)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'SUBMITTED', submitted_by: OTHER, version: 3 }) as never,
    )
    await expect(
      approveProfile({ userId: 'admin', profileId: PROFILE, input: action, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
    expect(withIdempotency).not.toHaveBeenCalled()
  })

  it('approves with the version the reviewer saw', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'SUBMITTED', version: 2 }) as never,
    )
    vi.mocked(voice.GET_PROFILE_IN_TX).mockResolvedValue(
      profile({ review_state: 'SUBMITTED', version: 2 }) as never,
    )
    vi.mocked(voice.GET_CENTRAL_PROFILE).mockResolvedValue({ id: PROFILE } as never)
    runIdempotently(PROFILE)
    await approveProfile({ userId: OTHER, profileId: PROFILE, input: action, requestId: 'r' })
    expect(voice.REVIEW_APPROVE).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ versionAtApproval: 2 }),
    )
  })

  it('is idempotent on repeat approval (no duplicate review/outbox)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'SUBMITTED', version: 2 }) as never,
    )
    vi.mocked(voice.GET_PROFILE_IN_TX).mockResolvedValue(
      profile({ review_state: 'SUBMITTED', version: 2 }) as never,
    )
    vi.mocked(voice.GET_CENTRAL_PROFILE).mockResolvedValue({ id: PROFILE } as never)
    runIdempotently(PROFILE)
    await approveProfile({
      userId: OTHER,
      profileId: PROFILE,
      input: action as never,
      requestId: 'r',
    })
    expect(voice.REVIEW_APPROVE).toHaveBeenCalledTimes(1)

    // Re-approve already-approved profile with a fresh key: short-circuits,
    // withIdempotency/REVIEW_APPROVE must NOT run again → no duplicate outbox.
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'APPROVED', version: 2 }) as never,
    )
    await approveProfile({
      userId: OTHER,
      profileId: PROFILE,
      input: action as never,
      requestId: 'r',
    })
    expect(withIdempotency).toHaveBeenCalledTimes(1)
    expect(voice.REVIEW_APPROVE).toHaveBeenCalledTimes(1)
  })
})

describe('rejectProfile / disableProfile / revokeProfileConsent (Task 38, F4VO V3/V4)', () => {
  const rejectInput = { version: 1, reason: 'sample too short' }

  it('rejects with a reason', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({
        review_state: 'SUBMITTED',
        submitted_by: OTHER,
        pastor: { name: 'P', user_id: OTHER },
      }) as never,
    )
    vi.mocked(voice.GET_CENTRAL_PROFILE).mockResolvedValue({ id: PROFILE } as never)
    vi.mocked(dbTransaction).mockImplementation(dbRun as never)
    await rejectProfile({ userId: U, profileId: PROFILE, input: rejectInput, requestId: 'r' })
    expect(voice.REVIEW_REJECT).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ reason: 'sample too short' }),
    )
  })

  it('denies self-rejection (reviewer is the submitter/linked pastor)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'SUBMITTED' }) as never,
    )
    await expect(
      rejectProfile({ userId: U, profileId: PROFILE, input: rejectInput, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'SELF_APPROVAL' })
    expect(voice.REVIEW_REJECT).not.toHaveBeenCalled()
  })

  it.each(['DRAFT', 'APPROVED', 'REJECTED'])('denies rejecting a %s profile', async (state) => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(profile({ review_state: state }) as never)
    await expect(
      rejectProfile({ userId: OTHER, profileId: PROFILE, input: rejectInput, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'INVALID_STATE' })
    expect(voice.REVIEW_REJECT).not.toHaveBeenCalled()
  })

  it('disables an approved profile (blocks registration + generation)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'APPROVED', registration_state: 'READY' }) as never,
    )
    vi.mocked(voice.GET_CENTRAL_PROFILE).mockResolvedValue({ id: PROFILE } as never)
    vi.mocked(dbTransaction).mockImplementation(dbRun as never)
    await disableProfile({ userId: OTHER, profileId: PROFILE, version: 1, requestId: 'r' })
    expect(voice.REVIEW_DISABLE).toHaveBeenCalled()
  })

  it('denies disabling a draft or an already-disabled profile', async () => {
    for (const over of [
      { review_state: 'DRAFT' },
      { review_state: 'APPROVED', registration_state: 'DISABLED' },
    ]) {
      vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(profile(over) as never)
      await expect(
        disableProfile({ userId: OTHER, profileId: PROFILE, version: 1, requestId: 'r' }),
      ).rejects.toMatchObject({ code: 409, error_code: 'INVALID_STATE' })
    }
    expect(voice.REVIEW_DISABLE).not.toHaveBeenCalled()
  })

  it('revokes consent', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'APPROVED', registration_state: 'READY' }) as never,
    )
    vi.mocked(voice.GET_CENTRAL_PROFILE).mockResolvedValue({ id: PROFILE } as never)
    vi.mocked(dbTransaction).mockImplementation(dbRun as never)
    await revokeProfileConsent({ userId: OTHER, profileId: PROFILE, version: 1, requestId: 'r' })
    expect(voice.REVOKE_CONSENT).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ profileId: PROFILE, inputVersion: 1 }),
    )
  })

  it('denies revoking an already revoked consent', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ consent: { revoked_at: new Date() } }) as never,
    )
    await expect(
      revokeProfileConsent({ userId: OTHER, profileId: PROFILE, version: 1, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'CONSENT_REVOKED' })
    expect(voice.REVOKE_CONSENT).not.toHaveBeenCalled()
  })
})

describe('DTOs never expose provider secrets (Task 37, F4VO V2)', () => {
  it('list/own schema has no provider Voice ID or secrets', () => {
    const keys = Object.keys(VoiceProfileListItemSchema.shape as Record<string, unknown>).join(',')
    expect(keys).not.toMatch(/providerVoiceId|provider_voice_id|apiKey|api_key|objectKey/)
  })
  it('central detail has the read-only Voice ID but no secrets or storage keys', () => {
    const keys = Object.keys(VoiceProfileDetailSchema.shape as Record<string, unknown>)
    expect(keys).toContain('providerVoiceId')
    expect(keys.join(',')).not.toMatch(/apiKey|api_key|objectKey|object_key/)
  })
  it('listCentralProfiles delegates to provider', async () => {
    vi.mocked(voice.LIST_CENTRAL_PROFILES).mockResolvedValue({ result: [], total: 0 })
    await expect(listCentralProfiles({ query: {} as never })).resolves.toEqual({
      result: [],
      total: 0,
    })
  })
  it('listOwnSubmissions delegates', async () => {
    vi.mocked(voice.LIST_OWN_PROFILES).mockResolvedValue({ result: [], total: 0 })
    await expect(
      listOwnSubmissions({ userId: U, churchIds: SCORE, query: {} as never }),
    ).resolves.toEqual({ result: [], total: 0 })
  })
  it('getCentralProfile returns detail or null', async () => {
    vi.mocked(voice.GET_CENTRAL_PROFILE).mockResolvedValue(null)
    await expect(getCentralProfile({ profileId: PROFILE })).resolves.toBeNull()
  })
})

describe('createSubmission (Task 36)', () => {
  const input = { sampleAssetIds: [ASSET], consentId: CONSENT, churchId: CHURCH }

  it('creates a draft with validated samples + consent', async () => {
    vi.mocked(GET_PASTOR_BY_USER_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(voice.GET_CHURCH_PASTOR).mockResolvedValue({ church_id: CHURCH } as never)
    vi.mocked(voice.GET_ASSET).mockResolvedValue(asset({ purpose: 'VOICE_SAMPLE' }) as never)
    vi.mocked(voice.GET_CONSENT).mockResolvedValue({
      id: CONSENT,
      pastor_id: 'p1',
      user_id: U,
      purpose: 'voice_cloning',
      revoked_at: null,
    } as never)
    runIdempotently(PROFILE)
    vi.mocked(voice.GET_PROFILE_LIST_ITEM).mockResolvedValue({ id: PROFILE } as never)
    vi.mocked(voice.CREATE_DRAFT).mockResolvedValue({ id: PROFILE } as never)
    const res = await createSubmission({
      userId: U,
      churchIds: SCORE,
      input,
      idempotencyKey: 'k',
      requestId: 'r',
    })
    expect(voice.CREATE_DRAFT).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'elevenlabs',
          pastorId: 'p1',
          sampleAssetIds: [ASSET],
        }),
      }),
    )
    expect(res.id).toBe(PROFILE)
  })

  it('rejects a church the pastor is not assigned to', async () => {
    vi.mocked(GET_PASTOR_BY_USER_ID).mockResolvedValue({ id: 'p1' } as never)
    await expect(
      createSubmission({
        userId: U,
        churchIds: new Set(['other-church']),
        input,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 403, error_code: 'CHURCH_NOT_ASSIGNED' })
  })

  it('rejects a church in role scope where the pastor has no assignment', async () => {
    vi.mocked(GET_PASTOR_BY_USER_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(voice.GET_CHURCH_PASTOR).mockResolvedValue(null)
    await expect(
      createSubmission({ userId: U, churchIds: SCORE, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'CHURCH_NOT_ASSIGNED' })
    expect(voice.CREATE_DRAFT).not.toHaveBeenCalled()
  })
})

describe('recloneVoiceProfile (F4VO V8)', () => {
  const args = {
    userId: OTHER,
    churchId: CHURCH,
    churchIds: SCORE,
    profileId: PROFILE,
    requestId: 'r',
  }
  const missing = (over: Record<string, unknown> = {}) =>
    profile({
      review_state: 'APPROVED',
      registration_state: 'FAILED',
      last_error_code: 'PROVIDER_VOICE_MISSING',
      ...over,
    })

  it('queues a re-clone for a voice missing at the provider', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(missing() as never)
    vi.mocked(voice.GET_PROFILE_LIST_ITEM).mockResolvedValue({ id: PROFILE } as never)
    runIdempotently(PROFILE)
    await recloneVoiceProfile({ ...args, idempotencyKey: 'k' })
    expect(voice.REQUEST_RECLONE).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ profileId: PROFILE, actorId: OTHER }),
    )
  })

  it('denies a church outside the caller scope', async () => {
    await expect(
      recloneVoiceProfile({ ...args, churchIds: new Set(['other']) }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('hides a voice from another church (404)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(missing({ church_id: 'c-other' }) as never)
    await expect(recloneVoiceProfile(args)).rejects.toMatchObject({ code: 404 })
  })

  it.each([
    ['READY voice', { registration_state: 'READY', last_error_code: null }, 'INVALID_STATE'],
    [
      'changed sample (needs new submission)',
      { last_error_code: 'CHECKSUM_MISMATCH' },
      'RETRY_NOT_POSSIBLE',
    ],
    [
      'unresolved create (duplicate risk)',
      { last_error_code: 'REGISTRATION_UNRESOLVED' },
      'RETRY_NOT_POSSIBLE',
    ],
    ['disabled voice', { registration_state: 'DISABLED' }, 'PROFILE_DISABLED'],
    ['revoked consent', { consent: { revoked_at: new Date() } }, 'CONSENT_REVOKED'],
  ])('refuses a %s', async (_name, over, code) => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(missing(over) as never)
    await expect(recloneVoiceProfile(args)).rejects.toMatchObject({ code: 409, error_code: code })
    expect(voice.REQUEST_RECLONE).not.toHaveBeenCalled()
  })

  it.each(['VOICE_CREATE_REJECTED', 'VOICE_LIMIT_REACHED', 'INTERNAL_JOB_ERROR'])(
    'retries a registration that failed with %s',
    async (code) => {
      vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
        missing({ last_error_code: code }) as never,
      )
      vi.mocked(voice.GET_PROFILE_LIST_ITEM).mockResolvedValue({ id: PROFILE } as never)
      runIdempotently(PROFILE)
      await recloneVoiceProfile({ ...args, idempotencyKey: 'k' })
      expect(voice.REQUEST_RECLONE).toHaveBeenCalled()
    },
  )

  it('a repeat click while re-creating returns the current state', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      missing({ registration_state: 'QUEUED' }) as never,
    )
    vi.mocked(voice.GET_PROFILE_LIST_ITEM).mockResolvedValue({ id: PROFILE } as never)
    await expect(recloneVoiceProfile(args)).resolves.toEqual({ id: PROFILE })
    expect(withIdempotency).not.toHaveBeenCalled()
  })
})
