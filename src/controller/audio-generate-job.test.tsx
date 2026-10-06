// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

/*
 * Unit tests for the audio.generate job controller (PR-07). All provider
 * seams are mocked: the suite asserts the guard ladder, retry decisions and
 * finalize races — not Prisma/S3/provider behavior.
 */

const mocks = vi.hoisted(() => {
  const fns = (names: string[]) => Object.fromEntries(names.map((n) => [n, vi.fn()]))
  return {
    elevenlabs: fns(['generateSpeech', 'isElevenLabsEnabled']),
    outbox: fns(['CLAIM_PENDING_JOBS', 'GET_JOB', 'MARK_JOB_STATE']),
    prayerAudio: fns([
      'GET_AUDIO_FOR_JOB',
      'SET_AUDIO_GENERATING',
      'RESET_AUDIO_QUEUED',
      'FINALIZE_AUDIO_READY',
      'FINALIZE_AUDIO_FAILED',
    ]),
    s3: fns(['S3_PUT_OBJECT', 'S3_DELETE_OBJECT']),
    media: fns(['CREATE_PENDING_ASSET', 'MARK_READY', 'DELETE_ASSET']),
    hash: fns(['hashBytes']),
  }
})

vi.mock('@/providers/elevenlabs', () => {
  class TtsError extends Error {
    constructor(
      public retryable: boolean,
      public errorCode: string,
      message: string,
      public providerStatus?: number,
    ) {
      super(message)
      this.name = 'TtsError'
    }
  }
  return {
    TtsError,
    isElevenLabsEnabled: mocks.elevenlabs.isElevenLabsEnabled,
    ELEVENLABS: { generateSpeech: mocks.elevenlabs.generateSpeech },
  }
})
vi.mock('@/providers/outbox-job', () => mocks.outbox)
vi.mock('@/providers/prayer-audio', () => mocks.prayerAudio)
vi.mock('@/providers/s3', () => mocks.s3)
vi.mock('@/providers/media', () => mocks.media)
vi.mock('@/utils/hash', () => mocks.hash)

import { processAudioGenerateJob, runAudioGenerateTick } from './audio-generate-job'
import { TtsError } from '@/providers/elevenlabs'

const baseJob = {
  id: 'job1',
  kind: 'audio.generate',
  dedupe_key: 'dk',
  resource_id: 'a1',
  payload: { textHash: 'hash1' } as unknown,
  available_at: new Date(),
  state: 'RUNNING' as const,
  attempts: 1,
  lease_until: new Date(),
  last_error_code: null,
  created_at: new Date(),
  updated_at: new Date(),
}

const baseResource = {
  id: 'a1',
  status: 'QUEUED',
  provider_request_id: null,
  verse: {
    id: 'v1',
    approved_at: new Date() as Date | null,
    text_hash: 'hash1',
    body: 'Praise the Lord',
    language_code: 'et',
    version_number: 1,
    pastor_id: 'p1',
    prayer: { id: 'pr1', church_id: 'c1', version: 1, current_version_id: 'v1' },
  },
  voice_profile: {
    id: 'vp1',
    church_id: 'c1',
    provider_voice_id: 'pv_1' as string | null,
    review_state: 'APPROVED',
    registration_state: 'READY',
    consent: { revoked_at: null as Date | null },
  },
}

const speechResult = {
  providerRequestId: 'req-7',
  contentType: 'audio/mpeg',
  bytes: new Uint8Array([1, 2, 3]),
}

const expectJobDone = (state: 'SUCCEEDED' | 'FAILED', errorCode?: string) =>
  expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith({
    jobId: 'job1',
    state,
    ...(errorCode ? { errorCode } : {}),
  })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.outbox.GET_JOB.mockResolvedValue(baseJob)
  mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockResolvedValue(structuredClone(baseResource))
  mocks.elevenlabs.isElevenLabsEnabled.mockReturnValue(true)
  mocks.elevenlabs.generateSpeech.mockResolvedValue(speechResult)
  mocks.prayerAudio.SET_AUDIO_GENERATING.mockResolvedValue({ count: 1 })
  mocks.prayerAudio.FINALIZE_AUDIO_READY.mockResolvedValue({ count: 1 })
  mocks.prayerAudio.FINALIZE_AUDIO_FAILED.mockResolvedValue({ count: 1 })
  mocks.prayerAudio.RESET_AUDIO_QUEUED.mockResolvedValue({ count: 1 })
  mocks.media.CREATE_PENDING_ASSET.mockResolvedValue({ id: 'asset1' })
  mocks.media.MARK_READY.mockResolvedValue({ count: 1 })
  mocks.s3.S3_PUT_OBJECT.mockResolvedValue({ key: 'k', byteSize: 3 })
  mocks.hash.hashBytes.mockReturnValue('digest1')
})

describe('processAudioGenerateJob — preconditions', () => {
  it('skips when the job row is missing or not RUNNING', async () => {
    mocks.outbox.GET_JOB.mockResolvedValueOnce(null)
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('skipped')

    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, state: 'PENDING' })
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('skipped')

    mocks.outbox.GET_JOB.mockResolvedValueOnce({ ...baseJob, resource_id: null })
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('skipped')
    expect(mocks.prayerAudio.GET_AUDIO_FOR_JOB).not.toHaveBeenCalled()
  })

  it('marks SUCCEEDED when the audio resource was deleted', async () => {
    mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockResolvedValue(null)
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('succeeded')
    expectJobDone('SUCCEEDED')
    expect(mocks.elevenlabs.generateSpeech).not.toHaveBeenCalled()
  })

  it('marks SUCCEEDED without generation for duplicate delivery of a READY/APPROVED audio', async () => {
    mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockResolvedValue({
      ...structuredClone(baseResource),
      status: 'READY',
    })
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('succeeded')
    expectJobDone('SUCCEEDED')
    expect(mocks.elevenlabs.generateSpeech).not.toHaveBeenCalled()
    expect(mocks.s3.S3_PUT_OBJECT).not.toHaveBeenCalled()
  })
})

describe('processAudioGenerateJob — guard ladder', () => {
  const failCase = (name: string, mutate: () => void, errorCode: string) => {
    it(name, async () => {
      mutate()
      await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('failed')
      expect(mocks.prayerAudio.FINALIZE_AUDIO_FAILED).toHaveBeenCalledWith(
        expect.objectContaining({ audioId: 'a1', churchId: 'c1', errorCode }),
      )
      expectJobDone('FAILED', errorCode)
      expect(mocks.elevenlabs.generateSpeech).not.toHaveBeenCalled()
      expect(mocks.prayerAudio.FINALIZE_AUDIO_READY).not.toHaveBeenCalled()
      expect(mocks.media.MARK_READY).not.toHaveBeenCalled()
      expect(mocks.media.CREATE_PENDING_ASSET).not.toHaveBeenCalled()
    })
  }

  failCase(
    'fails VOICE_WRONG_CHURCH when the voice belongs to another church',
    () => {
      const r = structuredClone(baseResource)
      r.voice_profile.church_id = 'c2'
      mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockResolvedValue(r)
    },
    'VOICE_WRONG_CHURCH',
  )

  failCase(
    'fails TEXT_NOT_APPROVED when the text version has no approval',
    () => {
      const r = structuredClone(baseResource)
      r.verse.approved_at = null
      mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockResolvedValue(r)
    },
    'TEXT_NOT_APPROVED',
  )

  failCase(
    'fails STALE_SNAPSHOT when the version is no longer current',
    () => {
      const r = structuredClone(baseResource)
      r.verse.prayer.current_version_id = 'v2'
      mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockResolvedValue(r)
    },
    'STALE_SNAPSHOT',
  )

  failCase(
    'fails STALE_SNAPSHOT when the payload hash no longer matches the approved snapshot',
    () => {
      const r = structuredClone(baseResource)
      r.verse.text_hash = 'hash2'
      mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockResolvedValue(r)
    },
    'STALE_SNAPSHOT',
  )

  failCase(
    'fails VOICE_NOT_READY when review or registration is not final-ready',
    () => {
      const r = structuredClone(baseResource)
      r.voice_profile.registration_state = 'VERIFICATION_REQUIRED'
      mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockResolvedValue(r)
    },
    'VOICE_NOT_READY',
  )

  failCase(
    'fails VOICE_CONSENT_REVOKED when consent was revoked mid-flight',
    () => {
      const r = structuredClone(baseResource)
      r.voice_profile.consent = { revoked_at: new Date() }
      mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockResolvedValue(r)
    },
    'VOICE_CONSENT_REVOKED',
  )

  failCase(
    'fails VOICE_UNREGISTERED when no provider voice id exists',
    () => {
      const r = structuredClone(baseResource)
      r.voice_profile.provider_voice_id = null
      mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockResolvedValue(r)
    },
    'VOICE_UNREGISTERED',
  )

  failCase(
    'fails ELEVENLABS_DISABLED when the provider flag is off',
    () => {
      mocks.elevenlabs.isElevenLabsEnabled.mockReturnValue(false)
    },
    'ELEVENLABS_DISABLED',
  )
})

describe('processAudioGenerateJob — generation happy path', () => {
  it('generates, stores in S3, creates + readies the asset, finalizes READY', async () => {
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('succeeded')

    expect(mocks.prayerAudio.SET_AUDIO_GENERATING).toHaveBeenCalledWith({ audioId: 'a1' })
    expect(mocks.elevenlabs.generateSpeech).toHaveBeenCalledWith({
      providerVoiceId: 'pv_1',
      text: 'Praise the Lord',
    })
    const s3Call = mocks.s3.S3_PUT_OBJECT.mock.calls[0][0] as {
      key: string
      body: Uint8Array
      contentType: string
    }
    expect(s3Call.key).toMatch(/^media\/c1\/generated_audio\//)
    expect(s3Call.body).toEqual(speechResult.bytes)
    expect(s3Call.contentType).toBe('audio/mpeg')
    expect(mocks.media.CREATE_PENDING_ASSET).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'c1',
        purpose: 'GENERATED_AUDIO',
        mimeType: 'audio/mpeg',
        byteSize: 3,
        objectKey: s3Call.key,
        uploadedBy: null,
      }),
    )
    expect(mocks.media.MARK_READY).toHaveBeenCalledWith({
      churchIds: new Set(['c1']),
      assetId: 'asset1',
      checksum: 'digest1',
    })
    expect(mocks.prayerAudio.FINALIZE_AUDIO_READY).toHaveBeenCalledWith(
      expect.objectContaining({
        audioId: 'a1',
        churchId: 'c1',
        assetId: 'asset1',
        providerRequestId: 'req-7',
      }),
    )
    expectJobDone('SUCCEEDED')
  })

  it('skips without touching provider or S3 when another worker already claimed the transition', async () => {
    mocks.prayerAudio.SET_AUDIO_GENERATING.mockResolvedValueOnce({ count: 0 })
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('skipped')
    expect(mocks.elevenlabs.generateSpeech).not.toHaveBeenCalled()
    expect(mocks.s3.S3_PUT_OBJECT).not.toHaveBeenCalled()
  })

  it('rolls the asset back and succeeds when the finalize race is lost', async () => {
    mocks.prayerAudio.FINALIZE_AUDIO_READY.mockResolvedValueOnce({ count: 0 })
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('succeeded')
    expect(mocks.media.DELETE_ASSET).toHaveBeenCalledWith({ assetId: 'asset1' })
    const s3Call = mocks.s3.S3_PUT_OBJECT.mock.calls[0][0] as { key: string }
    expect(mocks.s3.S3_DELETE_OBJECT).toHaveBeenCalledWith({ key: s3Call.key })
    expectJobDone('SUCCEEDED')
  })
})

describe('processAudioGenerateJob — retry decisions', () => {
  it('fails permanently on a non-retryable TtsError', async () => {
    mocks.elevenlabs.generateSpeech.mockRejectedValueOnce(
      new TtsError(false, 'TTS_EMPTY_AUDIO', 'empty'),
    )
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('failed')
    expect(mocks.prayerAudio.RESET_AUDIO_QUEUED).not.toHaveBeenCalled()
    expectJobDone('FAILED', 'TTS_EMPTY_AUDIO')
  })

  it('requeues with backoff on a retryable TtsError before MAX_ATTEMPTS', async () => {
    mocks.elevenlabs.generateSpeech.mockRejectedValueOnce(new TtsError(true, 'TTS_NETWORK', 'boom'))
    const before = Date.now()
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('requeued')
    expect(mocks.prayerAudio.RESET_AUDIO_QUEUED).toHaveBeenCalledWith({ audioId: 'a1' })
    const mark = mocks.outbox.MARK_JOB_STATE.mock.calls[0][0] as {
      jobId: string
      state: string
      errorCode?: string
      availableAt?: Date
    }
    expect(mark.jobId).toBe('job1')
    expect(mark.state).toBe('PENDING')
    expect(mark.errorCode).toBe('TTS_NETWORK')
    expect(mark.availableAt!.getTime()).toBeGreaterThanOrEqual(before + 30_000 * 2 ** 1 - 1000)
    expect(mocks.prayerAudio.FINALIZE_AUDIO_FAILED).not.toHaveBeenCalled()
  })

  it('ends FAILED after MAX_ATTEMPTS retryable failures', async () => {
    mocks.elevenlabs.generateSpeech.mockRejectedValueOnce(new TtsError(true, 'TTS_NETWORK', 'boom'))
    mocks.outbox.GET_JOB.mockResolvedValue({ ...baseJob, attempts: 3 })
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('failed')
    expect(mocks.prayerAudio.FINALIZE_AUDIO_FAILED).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'TTS_NETWORK' }),
    )
    expectJobDone('FAILED', 'TTS_NETWORK')
    expect(mocks.outbox.MARK_JOB_STATE).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: 'PENDING' }),
    )
  })

  it('requeues INTERNAL_JOB_ERROR when infra throws (S3 put)', async () => {
    mocks.s3.S3_PUT_OBJECT.mockRejectedValueOnce(new Error('S3 unavailable'))
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('requeued')
    expect(mocks.prayerAudio.RESET_AUDIO_QUEUED).toHaveBeenCalledWith({ audioId: 'a1' })
    expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'PENDING', errorCode: 'INTERNAL_JOB_ERROR' }),
    )
  })

  it('ends FAILED with INTERNAL_JOB_ERROR when infra throws at MAX_ATTEMPTS', async () => {
    mocks.s3.S3_PUT_OBJECT.mockRejectedValueOnce(new Error('S3 unavailable'))
    mocks.outbox.GET_JOB.mockResolvedValue({ ...baseJob, attempts: 9 })
    await expect(processAudioGenerateJob('job1', 'rq')).resolves.toBe('failed')
    expect(mocks.prayerAudio.FINALIZE_AUDIO_FAILED).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'INTERNAL_JOB_ERROR' }),
    )
    expectJobDone('FAILED', 'INTERNAL_JOB_ERROR')
  })

  it('treats a non-finite env max attempts as the default 3', async () => {
    const prev = process.env.AUDIO_GENERATE_MAX_ATTEMPTS
    process.env.AUDIO_GENERATE_MAX_ATTEMPTS = 'banana'
    vi.resetModules()
    const { processAudioGenerateJob: fresh } = await import('./audio-generate-job')
    mocks.outbox.GET_JOB.mockResolvedValue({ ...baseJob, attempts: 3 })
    mocks.elevenlabs.generateSpeech.mockRejectedValueOnce(new TtsError(true, 'TTS_NETWORK', 'boom'))
    await expect(fresh('job1', 'rq')).resolves.toBe('failed')
    process.env.AUDIO_GENERATE_MAX_ATTEMPTS = prev
    vi.resetModules()
  })
})

describe('runAudioGenerateTick', () => {
  it('aggregates outcomes across claimed jobs', async () => {
    mocks.outbox.CLAIM_PENDING_JOBS.mockResolvedValue([
      { id: 'job1' },
      { id: 'job2' },
      { id: 'job3' },
    ])
    let n = 0
    mocks.outbox.GET_JOB.mockImplementation(async ({ jobId }: { jobId: string }) => ({
      ...baseJob,
      id: jobId,
    }))
    mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockImplementation(async () => {
      n++
      if (n === 1) return structuredClone(baseResource)
      if (n === 2) return { ...structuredClone(baseResource), status: 'READY' }
      return {
        ...structuredClone(baseResource),
        verse: { ...structuredClone(baseResource).verse, approved_at: null },
      }
    })
    const summary = await runAudioGenerateTick({ limit: 3 })
    expect(summary).toEqual({ claimed: 3, succeeded: 2, failed: 1, requeued: 0, skipped: 0 })
    expect(mocks.outbox.CLAIM_PENDING_JOBS).toHaveBeenCalledWith({
      kind: 'audio.generate',
      limit: 3,
    })
  })

  it('isolates one crashing job and keeps processing the rest', async () => {
    mocks.outbox.CLAIM_PENDING_JOBS.mockResolvedValue([{ id: 'job1' }, { id: 'job2' }])
    mocks.outbox.GET_JOB.mockImplementation(async ({ jobId }: { jobId: string }) => ({
      ...baseJob,
      id: jobId,
    }))
    let n = 0
    mocks.prayerAudio.GET_AUDIO_FOR_JOB.mockImplementation(async () => {
      n++
      if (n === 1) throw new Error('db hiccup')
      return structuredClone(baseResource)
    })
    mocks.outbox.MARK_JOB_STATE.mockRejectedValueOnce(new Error('db down'))
    const summary = await runAudioGenerateTick()
    expect(summary).toEqual({ claimed: 2, succeeded: 1, failed: 0, requeued: 0, skipped: 1 })
  })
})
