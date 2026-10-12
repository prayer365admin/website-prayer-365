// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * voice.register job controller (F4VO VO-07). Provider seams are mocked: the
 * suite asserts the guard ladder, no-duplicate-create rules, verification hold,
 * in-flight revocation and retry decisions — not Prisma/S3/ElevenLabs behavior.
 */

const mocks = vi.hoisted(() => {
  const fns = (names: string[]) => Object.fromEntries(names.map((n) => [n, vi.fn()]))
  return {
    elevenlabs: fns([
      'registerInstantVoice',
      'getVoiceReadiness',
      'findVoiceByName',
      'isElevenLabsEnabled',
    ]),
    outbox: fns(['CLAIM_PENDING_JOBS', 'GET_JOB', 'MARK_JOB_STATE']),
    voice: fns([
      'GET_PROFILE_FOR_JOB',
      'SET_REGISTERING',
      'STORE_PROVIDER_VOICE',
      'SET_REGISTRATION_STATE',
      'FINALIZE_REGISTRATION_READY',
      'FINALIZE_REGISTRATION_FAILED',
      'AUDIT_REGISTRATION_DISCARDED',
    ]),
    s3: fns(['S3_GET_OBJECT_BYTES']),
    hash: fns(['hashBytes']),
  }
})

vi.mock('@/providers/elevenlabs', () => {
  class VoiceProviderError extends Error {
    constructor(
      public kind: 'retryable' | 'permanent' | 'ambiguous',
      public errorCode: string,
      message: string,
    ) {
      super(message)
    }
  }
  return {
    VoiceProviderError,
    isElevenLabsEnabled: mocks.elevenlabs.isElevenLabsEnabled,
    ELEVENLABS: {
      registerInstantVoice: mocks.elevenlabs.registerInstantVoice,
      getVoiceReadiness: mocks.elevenlabs.getVoiceReadiness,
      findVoiceByName: mocks.elevenlabs.findVoiceByName,
    },
  }
})
vi.mock('@/providers/outbox-job', () => mocks.outbox)
vi.mock('@/providers/voice', () => mocks.voice)
vi.mock('@/providers/s3', () => mocks.s3)
vi.mock('@/utils/hash', () => mocks.hash)

import { VoiceProviderError } from '@/providers/elevenlabs'
import { processVoiceRegisterJob, runVoiceRegisterTick, voiceName } from './voice-register-job'

const job = (attempts = 1) => ({
  id: 'job1',
  kind: 'voice.register',
  resource_id: 'vp1',
  state: 'RUNNING' as const,
  attempts,
})

const sample = (position: number, checksum = `sum${position}`) => ({
  position,
  checksum,
  asset: { church_id: 'c1', status: 'READY', object_key: `k${position}`, mime_type: 'audio/mpeg' },
})

const profile = (over: Record<string, unknown> = {}) => ({
  id: 'vp1',
  pastor_id: 'p1',
  church_id: 'c1',
  version: 3,
  review_state: 'APPROVED',
  registration_state: 'QUEUED',
  provider_voice_id: null as string | null,
  requires_verification: null,
  consent: { revoked_at: null as Date | null },
  samples: [sample(0), sample(1)],
  ...over,
})

const ready = { found: true, ready: true, requiresVerification: false }

const jobMarked = (state: string, errorCode?: string) =>
  expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
    expect.objectContaining({ jobId: 'job1', state, ...(errorCode ? { errorCode } : {}) }),
  )

beforeEach(() => {
  vi.resetAllMocks()
  mocks.outbox.GET_JOB.mockResolvedValue(job())
  mocks.voice.GET_PROFILE_FOR_JOB.mockResolvedValue(profile())
  mocks.voice.SET_REGISTERING.mockResolvedValue({ count: 1 })
  mocks.voice.FINALIZE_REGISTRATION_READY.mockResolvedValue({ count: 1 })
  mocks.voice.FINALIZE_REGISTRATION_FAILED.mockResolvedValue({ count: 1 })
  mocks.voice.SET_REGISTRATION_STATE.mockResolvedValue({ count: 1 })
  mocks.s3.S3_GET_OBJECT_BYTES.mockImplementation(async ({ key }: { key: string }) =>
    new TextEncoder().encode(key),
  )
  // bytes of k0 → sum0, k1 → sum1 (matches the frozen checksums)
  mocks.hash.hashBytes.mockImplementation(
    (b: Uint8Array) => `sum${new TextDecoder().decode(b).slice(1)}`,
  )
  mocks.elevenlabs.registerInstantVoice.mockResolvedValue({
    providerVoiceId: 'el_1',
    requiresVerification: false,
  })
  mocks.elevenlabs.getVoiceReadiness.mockResolvedValue(ready)
  mocks.elevenlabs.isElevenLabsEnabled.mockReturnValue(true)
})

describe('happy path', () => {
  it('sends every sample in order, stores the voice, then READY + active voice', async () => {
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('succeeded')
    const call = mocks.elevenlabs.registerInstantVoice.mock.calls[0][0]
    expect(call.name).toBe(voiceName('vp1', 3))
    expect(call.files.map((f: { filename: string }) => f.filename)).toEqual([
      'sample-1',
      'sample-2',
    ])
    expect(mocks.voice.STORE_PROVIDER_VOICE).toHaveBeenCalledWith({
      profileId: 'vp1',
      providerVoiceId: 'el_1',
      requiresVerification: false,
    })
    expect(mocks.voice.FINALIZE_REGISTRATION_READY).toHaveBeenCalledWith({
      profileId: 'vp1',
      churchId: 'c1',
      pastorId: 'p1',
      requestId: 'rq',
    })
    jobMarked('SUCCEEDED')
  })
})

describe('guard ladder (no provider call)', () => {
  it.each([
    ['not approved', { review_state: 'SUBMITTED' }, 'NOT_APPROVED'],
    ['consent revoked', { consent: { revoked_at: new Date() } }, 'VOICE_CONSENT_REVOKED'],
    ['no samples', { samples: [] }, 'NO_SAMPLES'],
    ['sample without checksum', { samples: [sample(0, '')] }, 'SAMPLE_INVALID'],
    [
      'sample from another church',
      { samples: [{ ...sample(0), asset: { ...sample(0).asset, church_id: 'c2' } }] },
      'SAMPLE_INVALID',
    ],
  ])('%s → FAILED', async (_name, over, code) => {
    mocks.voice.GET_PROFILE_FOR_JOB.mockResolvedValue(profile(over))
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('failed')
    expect(mocks.voice.FINALIZE_REGISTRATION_FAILED).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: code }),
    )
    expect(mocks.elevenlabs.registerInstantVoice).not.toHaveBeenCalled()
  })

  it('a tampered sample fails CHECKSUM_MISMATCH before any provider call', async () => {
    mocks.hash.hashBytes.mockReturnValue('other')
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('failed')
    expect(mocks.voice.FINALIZE_REGISTRATION_FAILED).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'CHECKSUM_MISMATCH' }),
    )
    expect(mocks.elevenlabs.registerInstantVoice).not.toHaveBeenCalled()
  })

  it.each(['DISABLED', 'READY', 'VERIFICATION_REQUIRED', 'FAILED'])(
    'a %s profile is skipped without a call',
    async (state) => {
      mocks.voice.GET_PROFILE_FOR_JOB.mockResolvedValue(profile({ registration_state: state }))
      await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('skipped')
      expect(mocks.elevenlabs.registerInstantVoice).not.toHaveBeenCalled()
      jobMarked('SUCCEEDED')
    },
  )

  it('disabled between claim and REGISTERING → no call', async () => {
    mocks.voice.SET_REGISTERING.mockResolvedValue({ count: 0 })
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('skipped')
    expect(mocks.elevenlabs.registerInstantVoice).not.toHaveBeenCalled()
  })
})

describe('never a duplicate create', () => {
  it('repeated delivery with a stored voice id reuses it', async () => {
    mocks.voice.GET_PROFILE_FOR_JOB.mockResolvedValue(
      profile({ registration_state: 'REGISTERING', provider_voice_id: 'el_old' }),
    )
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('succeeded')
    expect(mocks.elevenlabs.registerInstantVoice).not.toHaveBeenCalled()
    expect(mocks.elevenlabs.getVoiceReadiness).toHaveBeenCalledWith('el_old')
  })

  it('an ambiguous create → REGISTRATION_UNKNOWN and requeue', async () => {
    mocks.elevenlabs.registerInstantVoice.mockRejectedValue(
      new VoiceProviderError('ambiguous', 'VOICE_CREATE_TIMEOUT', 'timeout'),
    )
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('requeued')
    expect(mocks.voice.SET_REGISTRATION_STATE).toHaveBeenCalledWith({
      profileId: 'vp1',
      state: 'REGISTRATION_UNKNOWN',
      errorCode: 'VOICE_CREATE_TIMEOUT',
    })
    jobMarked('PENDING', 'VOICE_CREATE_TIMEOUT')
  })

  it('reconcile finds the voice by name → stored, READY, no second create', async () => {
    mocks.voice.GET_PROFILE_FOR_JOB.mockResolvedValue(
      profile({ registration_state: 'REGISTRATION_UNKNOWN' }),
    )
    mocks.elevenlabs.findVoiceByName.mockResolvedValue('el_found')
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('succeeded')
    expect(mocks.elevenlabs.findVoiceByName).toHaveBeenCalledWith(voiceName('vp1', 3))
    expect(mocks.elevenlabs.registerInstantVoice).not.toHaveBeenCalled()
    expect(mocks.voice.STORE_PROVIDER_VOICE).toHaveBeenCalledWith(
      expect.objectContaining({ providerVoiceId: 'el_found' }),
    )
    expect(mocks.voice.FINALIZE_REGISTRATION_READY).toHaveBeenCalled()
  })

  it('reconcile not found keeps waiting, then fails REGISTRATION_UNRESOLVED', async () => {
    mocks.voice.GET_PROFILE_FOR_JOB.mockResolvedValue(
      profile({ registration_state: 'REGISTRATION_UNKNOWN' }),
    )
    mocks.elevenlabs.findVoiceByName.mockResolvedValue(null)
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('requeued')
    mocks.outbox.GET_JOB.mockResolvedValue(job(5))
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('failed')
    expect(mocks.voice.FINALIZE_REGISTRATION_FAILED).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'REGISTRATION_UNRESOLVED' }),
    )
    expect(mocks.elevenlabs.registerInstantVoice).not.toHaveBeenCalled()
  })
})

describe('verification and in-flight revocation', () => {
  it('requires_verification from create → VERIFICATION_REQUIRED, held', async () => {
    mocks.elevenlabs.registerInstantVoice.mockResolvedValue({
      providerVoiceId: 'el_1',
      requiresVerification: true,
    })
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('succeeded')
    expect(mocks.voice.SET_REGISTRATION_STATE).toHaveBeenCalledWith({
      profileId: 'vp1',
      state: 'VERIFICATION_REQUIRED',
    })
    expect(mocks.voice.FINALIZE_REGISTRATION_READY).not.toHaveBeenCalled()
  })

  it('readiness says verification needed → held, not READY', async () => {
    mocks.elevenlabs.getVoiceReadiness.mockResolvedValue({
      found: true,
      ready: false,
      requiresVerification: true,
    })
    await processVoiceRegisterJob('job1', 'rq')
    expect(mocks.voice.FINALIZE_REGISTRATION_READY).not.toHaveBeenCalled()
  })

  it('consent revoked during the provider call → voice kept hidden, discarded', async () => {
    mocks.voice.GET_PROFILE_FOR_JOB.mockResolvedValueOnce(profile()).mockResolvedValueOnce(
      profile({ registration_state: 'DISABLED', consent: { revoked_at: new Date() } }),
    )
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('succeeded')
    expect(mocks.voice.STORE_PROVIDER_VOICE).toHaveBeenCalled()
    expect(mocks.voice.AUDIT_REGISTRATION_DISCARDED).toHaveBeenCalled()
    expect(mocks.voice.FINALIZE_REGISTRATION_READY).not.toHaveBeenCalled()
  })
})

describe('retry decisions', () => {
  it('retryable error → back to QUEUED and requeue', async () => {
    mocks.elevenlabs.registerInstantVoice.mockRejectedValue(
      new VoiceProviderError('retryable', 'VOICE_RATE_LIMITED', '429'),
    )
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('requeued')
    expect(mocks.voice.SET_REGISTRATION_STATE).toHaveBeenCalledWith({
      profileId: 'vp1',
      state: 'QUEUED',
      errorCode: 'VOICE_RATE_LIMITED',
    })
  })

  it('retryable error at max attempts → FAILED', async () => {
    mocks.outbox.GET_JOB.mockResolvedValue(job(5))
    mocks.s3.S3_GET_OBJECT_BYTES.mockRejectedValue(new Error('s3 down'))
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('failed')
    jobMarked('FAILED', 'INTERNAL_JOB_ERROR')
  })

  it('permanent provider error → FAILED with its code', async () => {
    mocks.elevenlabs.registerInstantVoice.mockRejectedValue(
      new VoiceProviderError('permanent', 'VOICE_LIMIT_REACHED', 'limit'),
    )
    await expect(processVoiceRegisterJob('job1', 'rq')).resolves.toBe('failed')
    expect(mocks.voice.FINALIZE_REGISTRATION_FAILED).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'VOICE_LIMIT_REACHED' }),
    )
  })
})

describe('runVoiceRegisterTick', () => {
  it('claims nothing while ElevenLabs is disabled (jobs wait, never fail)', async () => {
    mocks.elevenlabs.isElevenLabsEnabled.mockReturnValue(false)
    await expect(runVoiceRegisterTick()).resolves.toMatchObject({ enabled: false, claimed: 0 })
    expect(mocks.outbox.CLAIM_PENDING_JOBS).not.toHaveBeenCalled()
  })

  it('claims voice.register jobs and tallies outcomes', async () => {
    mocks.outbox.CLAIM_PENDING_JOBS.mockResolvedValue([{ id: 'job1', attempts: 1 }])
    await expect(runVoiceRegisterTick({ limit: 2 })).resolves.toMatchObject({
      claimed: 1,
      succeeded: 1,
    })
    expect(mocks.outbox.CLAIM_PENDING_JOBS).toHaveBeenCalledWith({
      kind: 'voice.register',
      limit: 2,
    })
  })
})
