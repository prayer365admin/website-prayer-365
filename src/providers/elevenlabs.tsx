import { NotImplementedError } from '@/utils/not-implemented-error'

/*
 * ElevenLabs external-service adapter (SPEC 9.3.1 / plan Task 45).
 *
 * registerInstantVoice / getVoiceReadiness stay stubs — they belong to the
 * voice-registration worker (VO-07). generateSpeech is the PR-07 audio leg.
 * The ELEVENLABS_ENABLED gate stays in front of every method so an accidental
 * call outside the worker can never silently hit the provider.
 */

const PENDING_MESSAGE = 'external integration pending — see Phase 10 worker/webhook deliverable'

const ensureEnabled = (method: string): void => {
  if (process.env.ELEVENLABS_ENABLED !== 'true') {
    throw new NotImplementedError(`ELEVENLABS.${method}: ${PENDING_MESSAGE}`)
  }
}

const pending = (method: string): never => {
  throw new NotImplementedError(`ELEVENLABS.${method}: ${PENDING_MESSAGE}`)
}

/** Feature flag: true only when the integration is enabled. */
export const isElevenLabsEnabled = () => process.env.ELEVENLABS_ENABLED === 'true'

/** Provider failure that carries its retryability + stable error code. */
export class TtsError extends Error {
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

export interface VoiceRegistrationRequest {
  profileId: string
  sampleAssetId: string
  approvedSampleChecksum: string
}
export interface VoiceRegistrationResult {
  providerVoiceId: string
  requiresVerification: boolean
}
export interface VoiceReadinessResult {
  ready: boolean
  requiresVerification: boolean
  providerVoiceId?: string
}
export interface SpeechRequest {
  providerVoiceId: string
  text: string
}
/** Raw provider speech output — asset creation belongs to the worker, not here. */
export interface SpeechResult {
  providerRequestId: string | null
  contentType: string
  bytes: Uint8Array
}

/** First non-empty request id from the known header variants. */
const requestIdFrom = (headers: Headers): string | null => {
  for (const name of ['request-id', 'x-request-id', 'xi-request-id']) {
    const v = headers.get(name)
    if (v && v.trim().length > 0) return v.trim()
  }
  return null
}

export const generateSpeech = async ({
  providerVoiceId,
  text,
}: SpeechRequest): Promise<SpeechResult> => {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new TtsError(false, 'TTS_NOT_CONFIGURED', 'ELEVENLABS_API_KEY is not set.')

  const base = process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io'
  const modelId = process.env.ELEVENLABS_TTS_MODEL_ID ?? 'eleven_v3'
  const timeoutMs = Number(process.env.ELEVENLABS_TIMEOUT_MS ?? 120000)

  let res: Response
  try {
    res = await fetch(`${base}/v1/text-to-speech/${providerVoiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: modelId }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw new TtsError(
      true,
      'TTS_NETWORK',
      err instanceof Error ? err.message : 'network error contacting ElevenLabs',
    )
  }

  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500
    const body = await res.text().catch(() => '')
    const message = `ElevenLabs TTS ${res.status}: ${body}`
    throw new TtsError(
      retryable,
      'TTS_REQUEST_FAILED',
      message.length > 200 ? `${message.slice(0, 200)}…` : message,
      res.status,
    )
  }

  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new TtsError(false, 'TTS_EMPTY_AUDIO', 'ElevenLabs returned an empty audio payload.')
  }
  return { providerRequestId: requestIdFrom(res.headers), contentType: 'audio/mpeg', bytes }
}

export const ELEVENLABS = {
  /** Instant Voice Cloning: register a reviewed/approved voice sample. */
  async registerInstantVoice(_req: VoiceRegistrationRequest): Promise<VoiceRegistrationResult> {
    ensureEnabled('registerInstantVoice')
    return pending('registerInstantVoice')
  },
  /** Get current provider readiness of a registered voice. */
  async getVoiceReadiness(_providerVoiceId: string): Promise<VoiceReadinessResult> {
    ensureEnabled('getVoiceReadiness')
    return pending('getVoiceReadiness')
  },
  /** Synthesize speech for an approved text from a ready voice. */
  generateSpeech,
}
