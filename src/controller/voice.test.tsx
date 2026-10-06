import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VoiceProfileDetailSchema, VoiceProfileListItemSchema } from '@/models/voice'

vi.mock('@/providers/pastor', () => ({ GET_PASTOR_BY_USER_ID: vi.fn() }))
vi.mock('@/providers/voice', () => ({
  CONSENT_PURPOSE: 'VOICE_CLONE',
  VOICE_PROVIDER: 'elevenlabs',
  CREATE_CONSENT: vi.fn(),
  CREATE_DRAFT: vi.fn(),
  GET_ASSET: vi.fn(),
  GET_CENTRAL_PROFILE: vi.fn(),
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
  REVIEW_REJECT: vi.fn(),
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
  rejectProfile,
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
      asset: { object_key: 'o', mime_type: 'audio/mpeg', checksum: 'abc' },
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
      purpose: 'VOICE_CLONE',
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
      expect.objectContaining({ purpose: 'VOICE_CLONE', pastor_id: 'p1', user_id: U }),
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
  it('freezes the sample checksum into SUBMITTED', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(profile() as never)
    vi.mocked(voice.GET_ASSET).mockResolvedValue(asset({ purpose: 'VOICE_SAMPLE' }) as never)
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
      expect.objectContaining({ profileId: PROFILE, sampleChecksum: 'abc', expectedVersion: 1 }),
    )
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
  const input = { version: 1, sampleAssetId: ASSET }

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

  it('is idempotent on repeat approval (no duplicate review/outbox)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(
      profile({ review_state: 'SUBMITTED' }) as never,
    )
    vi.mocked(voice.GET_PROFILE_IN_TX).mockResolvedValue(
      profile({ review_state: 'SUBMITTED' }) as never,
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

describe('rejectProfile / disableProfile (Task 38)', () => {
  it('rejects with a reason', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(profile() as never)
    vi.mocked(voice.GET_CENTRAL_PROFILE).mockResolvedValue({ id: PROFILE } as never)
    vi.mocked(dbTransaction).mockImplementation(dbRun as never)
    await rejectProfile({
      userId: OTHER,
      profileId: PROFILE,
      input: { version: 1, reason: 'sample too short' },
      requestId: 'r',
    })
    expect(voice.REVIEW_REJECT).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({ reason: 'sample too short' }),
    )
  })

  it('disables a profile (blocks registration)', async () => {
    vi.mocked(voice.GET_VOICE_PROFILE).mockResolvedValue(profile() as never)
    vi.mocked(voice.GET_CENTRAL_PROFILE).mockResolvedValue({ id: PROFILE } as never)
    vi.mocked(dbTransaction).mockImplementation(dbRun as never)
    await disableProfile({ userId: OTHER, profileId: PROFILE, version: 1, requestId: 'r' })
    expect(voice.REVIEW_DISABLE).toHaveBeenCalled()
  })
})

describe('DTOs never expose provider secrets (Task 37)', () => {
  it('list schema has no provider_voice_id / secrets', () => {
    const keys = Object.keys(VoiceProfileListItemSchema.shape as Record<string, unknown>).join(',')
    expect(keys).not.toMatch(/providerVoiceId|provider_voice_id|apiKey|api_key/)
  })
  it('detail schema has no provider_voice_id / secrets', () => {
    const keys = Object.keys(VoiceProfileDetailSchema.shape as Record<string, unknown>).join(',')
    expect(keys).not.toMatch(/providerVoiceId|provider_voice_id|apiKey|api_key/)
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
  const input = { sampleAssetId: ASSET, consentId: CONSENT, churchId: CHURCH }

  it('creates a draft with a validated sample + consent', async () => {
    vi.mocked(GET_PASTOR_BY_USER_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(voice.GET_ASSET).mockResolvedValue(asset({ purpose: 'VOICE_SAMPLE' }) as never)
    vi.mocked(voice.GET_CONSENT).mockResolvedValue({
      id: CONSENT,
      pastor_id: 'p1',
      user_id: U,
      purpose: 'VOICE_CLONE',
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
        data: expect.objectContaining({ provider: 'elevenlabs', pastorId: 'p1' }),
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
})
