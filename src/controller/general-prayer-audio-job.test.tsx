// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  getJob: vi.fn(),
  markJob: vi.fn(async () => ({})),
  claim: vi.fn(async () => [] as { id: string }[]),
  prayer: vi.fn(),
  setAudio: vi.fn(async () => ({ count: 1 })),
  generateSpeech: vi.fn(),
  enabled: vi.fn(() => true),
  put: vi.fn(async ({ key }: { key: string }) => ({ key, byteSize: 3 })),
  remove: vi.fn(async () => undefined),
  createAsset: vi.fn(async () => ({ id: 'asset-1' })),
  markReady: vi.fn(async () => ({ count: 1 })),
  deleteAsset: vi.fn(async () => ({})),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/providers/outbox-job', () => ({
  GET_JOB: calls.getJob,
  MARK_JOB_STATE: calls.markJob,
  CLAIM_PENDING_JOBS: calls.claim,
}))
vi.mock('@/providers/general-prayer', () => ({
  GET_GENERAL_PRAYER_BY_ID: calls.prayer,
  SET_GENERAL_PRAYER_AUDIO: calls.setAudio,
}))
vi.mock('@/providers/elevenlabs', () => ({
  ELEVENLABS: { generateSpeech: calls.generateSpeech },
  isElevenLabsEnabled: calls.enabled,
  TtsError: class TtsError extends Error {
    constructor(
      public retryable: boolean,
      public errorCode: string,
      message: string,
    ) {
      super(message)
      this.name = 'TtsError'
    }
  },
}))
vi.mock('@/providers/s3', () => ({
  S3_PUT_OBJECT: calls.put,
  S3_DELETE_OBJECT: calls.remove,
}))
vi.mock('@/providers/media', () => ({
  CREATE_PENDING_ASSET: calls.createAsset,
  MARK_READY_CHURCH_LESS: calls.markReady,
  DELETE_ASSET: calls.deleteAsset,
}))
vi.mock('@/utils/logger', () => ({ logger: calls.logger }))

import { TtsError } from '@/providers/elevenlabs'
import { generalPrayerSpeechText, processGeneralPrayerAudioJob } from './general-prayer-audio-job'

const VOICE = 'voice-gp'

const job = (over: Record<string, unknown> = {}) => ({
  id: 'job-1',
  state: 'RUNNING',
  attempts: 0,
  dedupe_key: 'general_prayer.audio:gp-1:1',
  resource_id: 'gp-1',
  payload: { version: 1 },
  ...over,
})

const prayer = (over: Record<string, unknown> = {}) => ({
  id: 'gp-1',
  slug: 'paivapalve-1',
  sequence: 1,
  title: 'Hoia oma jalga',
  introduction: null,
  body: '<p>Kes võib tulla Jumala ligi?</p>',
  verse: null,
  verse_reference: null,
  liturgical_note: null,
  references: null,
  language_code: 'et',
  audio_status: 'QUEUED',
  audio_asset_id: null,
  provider_request_id: null,
  last_error_code: null,
  audio_generated_at: null,
  is_active: true,
  version: 1,
  created_at: new Date('2026-11-01T00:00:00.000Z'),
  updated_at: null,
  audio_asset: null,
  ...over,
})

const previousAsset = {
  object_key: 'media/general_prayer/generated_audio/old.mp3',
  byte_size: BigInt(100),
  status: 'READY',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ELEVENLABS_GENERAL_PRAYER_VOICE_ID = VOICE
  calls.getJob.mockResolvedValue(job())
  calls.prayer.mockResolvedValue(prayer())
  calls.enabled.mockReturnValue(true)
  calls.setAudio.mockResolvedValue({ count: 1 })
  calls.generateSpeech.mockResolvedValue({
    providerRequestId: 'req-1',
    contentType: 'audio/mpeg',
    bytes: new Uint8Array([1, 2, 3]),
  })
  calls.claim.mockResolvedValue([])
})

describe('general_prayer.audio worker', () => {
  it('skips a job that is not RUNNING', async () => {
    calls.getJob.mockResolvedValue(job({ state: 'PENDING' }))
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('skipped')
    expect(calls.generateSpeech).not.toHaveBeenCalled()
  })

  it('creates a church-less READY asset and moves the prayer to READY', async () => {
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('succeeded')

    expect(calls.generateSpeech).toHaveBeenCalledWith({
      providerVoiceId: VOICE,
      text: 'Kes võib tulla Jumala ligi?',
      languageCode: 'et',
    })
    expect(calls.put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^media\/general_prayer\/generated_audio\//),
        contentType: 'audio/mpeg',
      }),
    )
    // A platform prayer has no church: the asset must be church-less.
    expect(calls.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: null, purpose: 'GENERATED_AUDIO', uploadedBy: null }),
    )
    expect(calls.markReady).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-1', checksum: expect.any(String) }),
    )
    expect(calls.setAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'READY',
        assetId: 'asset-1',
        providerRequestId: 'req-1',
        errorCode: null,
      }),
    )
    expect(calls.markJob).toHaveBeenCalledWith(expect.objectContaining({ state: 'SUCCEEDED' }))
  })

  it('is idempotent on replay: an already READY prayer does no work', async () => {
    calls.prayer.mockResolvedValue(
      prayer({ audio_status: 'READY', audio_asset_id: 'asset-0', audio_asset: previousAsset }),
    )
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.generateSpeech).not.toHaveBeenCalled()
    expect(calls.createAsset).not.toHaveBeenCalled()
  })

  it('skips an inactive prayer without generating audio', async () => {
    calls.prayer.mockResolvedValue(prayer({ is_active: false }))
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.generateSpeech).not.toHaveBeenCalled()
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'SUCCEEDED', errorCode: 'PRAYER_INACTIVE' }),
    )
  })

  it('stops when another worker already moved the row to GENERATING', async () => {
    calls.setAudio.mockResolvedValue({ count: 0 })
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('skipped')
    expect(calls.generateSpeech).not.toHaveBeenCalled()
  })

  it('fails with TTS_NOT_CONFIGURED when ElevenLabs is disabled', async () => {
    calls.enabled.mockReturnValue(false)
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('failed')
    expect(calls.generateSpeech).not.toHaveBeenCalled()
    expect(calls.setAudio).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorCode: 'TTS_NOT_CONFIGURED' }),
    )
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', errorCode: 'TTS_NOT_CONFIGURED' }),
    )
  })

  it('fails with TTS_NOT_CONFIGURED when the platform voice id is missing', async () => {
    delete process.env.ELEVENLABS_GENERAL_PRAYER_VOICE_ID
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('failed')
    expect(calls.generateSpeech).not.toHaveBeenCalled()
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'TTS_NOT_CONFIGURED' }),
    )
  })

  it('requeues a retryable provider failure with backoff and a QUEUED row', async () => {
    calls.generateSpeech.mockRejectedValue(new TtsError(true, 'TTS_NETWORK', 'timed out'))
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('requeued')
    expect(calls.setAudio).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'QUEUED', errorCode: 'TTS_NETWORK' }),
    )
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'PENDING', errorCode: 'TTS_NETWORK' }),
    )
  })

  it('fails immediately on a permanent provider failure', async () => {
    calls.generateSpeech.mockRejectedValue(new TtsError(false, 'TTS_REQUEST_FAILED', 'bad request'))
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('failed')
    expect(calls.setAudio).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorCode: 'TTS_REQUEST_FAILED' }),
    )
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', errorCode: 'TTS_REQUEST_FAILED' }),
    )
  })

  it('fails once the attempt budget is spent, even for a retryable error', async () => {
    calls.getJob.mockResolvedValue(job({ attempts: 3 }))
    calls.generateSpeech.mockRejectedValue(new TtsError(true, 'TTS_NETWORK', 'timed out'))
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('failed')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', errorCode: 'TTS_NETWORK' }),
    )
  })

  it('fails fast on a runtime misconfiguration instead of retrying it', async () => {
    const { GeneralError } = await import('@/utils/general-error')
    // Storage unconfigured: retrying cannot help, and the code must say so.
    calls.put.mockRejectedValueOnce(
      new GeneralError({
        code: 500,
        error: 'INTERNAL_ERROR',
        error_code: 'S3_NOT_CONFIGURED',
        details: 'Object storage is not configured.',
      }),
    )
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('failed')
    expect(calls.markJob).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', errorCode: 'S3_NOT_CONFIGURED' }),
    )
    expect(calls.setAudio).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorCode: 'S3_NOT_CONFIGURED' }),
    )
  })

  it('replaces the previous audio on regeneration and drops its object', async () => {
    calls.prayer.mockResolvedValue(
      prayer({ audio_status: 'FAILED', audio_asset_id: 'asset-0', audio_asset: previousAsset }),
    )
    await expect(processGeneralPrayerAudioJob('job-1', 'r1')).resolves.toBe('succeeded')
    expect(calls.remove).toHaveBeenCalledWith({ key: previousAsset.object_key })
    expect(calls.deleteAsset).toHaveBeenCalledWith({ assetId: 'asset-0' })
  })

  it('does not delete the new asset when regeneration reuses the same row', async () => {
    calls.prayer.mockResolvedValue(
      prayer({ audio_status: 'QUEUED', audio_asset_id: null, audio_asset: null }),
    )
    await processGeneralPrayerAudioJob('job-1', 'r1')
    expect(calls.deleteAsset).not.toHaveBeenCalled()
    expect(calls.remove).not.toHaveBeenCalled()
  })
})

describe('generalPrayerSpeechText', () => {
  it('joins the introduction and the body as plain text', () => {
    expect(
      generalPrayerSpeechText({
        introduction: '<p>Päevapalve</p>',
        body: '<p>Kes võib tulla Jumala ligi?</p>',
      }),
    ).toBe('Päevapalve\n\nKes võib tulla Jumala ligi?')
  })

  it('omits a missing introduction', () => {
    expect(generalPrayerSpeechText({ introduction: null, body: '<p>Aamen.</p>' })).toBe('Aamen.')
  })

  it('caps the text below the provider limit', () => {
    const text = generalPrayerSpeechText({ introduction: null, body: 'a'.repeat(20_000) })
    expect(text).toHaveLength(9_500)
  })
})
