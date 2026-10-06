// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'

const ENV_KEYS = [
  'ELEVENLABS_ENABLED',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_BASE_URL',
  'ELEVENLABS_TTS_MODEL_ID',
  'ELEVENLABS_TIMEOUT_MS',
] as const

const envSnapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
const restoreEnv = () => {
  for (const [k, v] of Object.entries(envSnapshot)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import { generateSpeech, TtsError, isElevenLabsEnabled } from './elevenlabs'

const okResponse = (bytes: Uint8Array, headers: Record<string, string> = {}) =>
  new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers,
  })

afterEach(() => {
  restoreEnv()
  fetchMock.mockReset()
})

describe('isElevenLabsEnabled', () => {
  it('is true only for the exact flag value', () => {
    process.env.ELEVENLABS_ENABLED = 'true'
    expect(isElevenLabsEnabled()).toBe(true)
    process.env.ELEVENLABS_ENABLED = '1'
    expect(isElevenLabsEnabled()).toBe(false)
    delete process.env.ELEVENLABS_ENABLED
    expect(isElevenLabsEnabled()).toBe(false)
  })
})

describe('generateSpeech', () => {
  const req = { providerVoiceId: 'pv_1', text: 'Praise the Lord' }

  it('posts text + model to the TTS endpoint with the api key header', async () => {
    process.env.ELEVENLABS_ENABLED = 'true'
    process.env.ELEVENLABS_API_KEY = 'k_test'
    fetchMock.mockResolvedValue(okResponse(new Uint8Array([1, 2, 3]), { 'request-id': 'req-9' }))

    const res = await generateSpeech(req)

    expect(res.bytes).toEqual(new Uint8Array([1, 2, 3]))
    expect(res.contentType).toBe('audio/mpeg')
    expect(res.providerRequestId).toBe('req-9')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/pv_1?output_format=mp3_44100_128')
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('k_test')
    const body = JSON.parse(String(init.body)) as { text: string; model_id: string }
    expect(body.text).toBe('Praise the Lord')
    expect(body.model_id).toBe('eleven_v3')
  })

  it('honors env overrides for base url, model and headers variants', async () => {
    process.env.ELEVENLABS_ENABLED = 'true'
    process.env.ELEVENLABS_API_KEY = 'k_test'
    process.env.ELEVENLABS_BASE_URL = 'https://tts.local'
    process.env.ELEVENLABS_TTS_MODEL_ID = 'eleven_multilingual_v2'
    fetchMock.mockResolvedValue(okResponse(new Uint8Array([1]), { 'x-request-id': 'alt-1' }))

    const res = await generateSpeech(req)

    expect(String(fetchMock.mock.calls[0][0])).toContain('https://tts.local/v1/text-to-speech/pv_1')
    expect(res.providerRequestId).toBe('alt-1')
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as {
      model_id: string
    }
    expect(body.model_id).toBe('eleven_multilingual_v2')
  })

  it('throws non-retryable TTS_NOT_CONFIGURED without an api key', async () => {
    process.env.ELEVENLABS_ENABLED = 'true'
    delete process.env.ELEVENLABS_API_KEY

    await expect(generateSpeech(req)).rejects.toMatchObject({
      name: 'TtsError',
      retryable: false,
      errorCode: 'TTS_NOT_CONFIGURED',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats empty provider audio as a permanent failure', async () => {
    process.env.ELEVENLABS_ENABLED = 'true'
    process.env.ELEVENLABS_API_KEY = 'k_test'
    fetchMock.mockResolvedValue(okResponse(new Uint8Array([])))

    await expect(generateSpeech(req)).rejects.toMatchObject({
      retryable: false,
      errorCode: 'TTS_EMPTY_AUDIO',
    })
  })

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
  ])('status %i maps to retryable=%s', async (status, retryable) => {
    process.env.ELEVENLABS_ENABLED = 'true'
    process.env.ELEVENLABS_API_KEY = 'k_test'
    fetchMock.mockResolvedValue(new Response('provider exploded', { status }))

    const err = await generateSpeech(req).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TtsError)
    expect((err as TtsError).retryable).toBe(retryable)
    expect((err as TtsError).errorCode).toBe('TTS_REQUEST_FAILED')
    expect((err as TtsError).providerStatus).toBe(status)
    expect((err as TtsError).message).toContain('provider exploded')
  })

  it('truncates long provider error bodies to 200 chars', async () => {
    process.env.ELEVENLABS_ENABLED = 'true'
    process.env.ELEVENLABS_API_KEY = 'k_test'
    fetchMock.mockResolvedValue(new Response('x'.repeat(500), { status: 500 }))

    const err = (await generateSpeech(req).catch((e: unknown) => e)) as TtsError
    expect(err.message.length).toBeLessThanOrEqual(201)
  })

  it('maps fetch rejection to retryable TTS_NETWORK', async () => {
    process.env.ELEVENLABS_ENABLED = 'true'
    process.env.ELEVENLABS_API_KEY = 'k_test'
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'))

    await expect(generateSpeech(req)).rejects.toMatchObject({
      retryable: true,
      errorCode: 'TTS_NETWORK',
    })
  })

  it('falls back to a null request id when headers are absent', async () => {
    process.env.ELEVENLABS_ENABLED = 'true'
    process.env.ELEVENLABS_API_KEY = 'k_test'
    fetchMock.mockResolvedValue(okResponse(new Uint8Array([1])))

    const res = await generateSpeech(req)
    expect(res.providerRequestId).toBeNull()
  })
})
