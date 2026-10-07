/*
 * ElevenLabs external-service adapter (SPEC 9.3.1).
 *
 * generateSpeech is the PR-07 audio leg; registerInstantVoice /
 * getVoiceReadiness / findVoiceByName are the F4VO voice.register leg. Only
 * workers call these, and only while ELEVENLABS_ENABLED=true. The API key
 * lives in ELEVENLABS_API_KEY only and is never logged or returned.
 */

const config = () => ({
  apiKey: process.env.ELEVENLABS_API_KEY,
  base: process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io',
  timeoutMs: Number(process.env.ELEVENLABS_TIMEOUT_MS ?? 120000),
})

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

/**
 * Voice-registration failure. `ambiguous` = the create request may have reached
 * ElevenLabs (timeout after send, 5xx): the voice might exist, so the worker
 * must reconcile by lookup instead of creating again (SPEC 9.3.1).
 */
export class VoiceProviderError extends Error {
  constructor(
    public kind: 'retryable' | 'permanent' | 'ambiguous',
    public errorCode: string,
    message: string,
    public providerStatus?: number,
  ) {
    super(message)
    this.name = 'VoiceProviderError'
  }
}

export interface VoiceSampleFile {
  bytes: Uint8Array
  mimeType: string
  filename: string
}
export interface VoiceRegistrationRequest {
  name: string
  description: string
  files: VoiceSampleFile[]
}
export interface VoiceRegistrationResult {
  providerVoiceId: string
  requiresVerification: boolean
}
export interface VoiceReadinessResult {
  /** false when ElevenLabs no longer has this voice. */
  found: boolean
  ready: boolean
  requiresVerification: boolean
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
  const { apiKey, base, timeoutMs } = config()
  if (!apiKey) throw new TtsError(false, 'TTS_NOT_CONFIGURED', 'ELEVENLABS_API_KEY is not set.')
  const modelId = process.env.ELEVENLABS_TTS_MODEL_ID ?? 'eleven_v3'

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

const clip = (message: string) => (message.length > 200 ? `${message.slice(0, 200)}…` : message)

const requireKey = () => {
  const cfg = config()
  if (!cfg.apiKey)
    throw new VoiceProviderError(
      'permanent',
      'VOICE_NOT_CONFIGURED',
      'ELEVENLABS_API_KEY is not set.',
    )
  return cfg as { apiKey: string; base: string; timeoutMs: number }
}

/** Connection never established (DNS, refused): the request cannot have reached ElevenLabs. */
const neverSent = (err: unknown) => {
  const code = (err as { cause?: { code?: string } })?.cause?.code ?? ''
  return ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET'].includes(code)
}

/**
 * Instant Voice Cloning: POST /v1/voices/add (multipart, one `files` part per
 * sample). Custom labels are not sent — IVC labels only accept
 * language/accent/gender/age, so identification lives in name/description.
 */
export const registerInstantVoice = async ({
  name,
  description,
  files,
}: VoiceRegistrationRequest): Promise<VoiceRegistrationResult> => {
  const { apiKey, base, timeoutMs } = requireKey()
  const form = new FormData()
  form.append('name', name)
  form.append('description', description)
  form.append('remove_background_noise', 'false')
  for (const f of files) {
    form.append('files', new Blob([f.bytes as BlobPart], { type: f.mimeType }), f.filename)
  }

  let res: Response
  try {
    res = await fetch(`${base}/v1/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error contacting ElevenLabs'
    if (neverSent(err)) throw new VoiceProviderError('retryable', 'VOICE_NETWORK', message)
    throw new VoiceProviderError('ambiguous', 'VOICE_CREATE_TIMEOUT', message)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const message = clip(`ElevenLabs IVC ${res.status}: ${body}`)
    if (res.status === 429)
      throw new VoiceProviderError('retryable', 'VOICE_RATE_LIMITED', message, 429)
    if (res.status >= 500)
      throw new VoiceProviderError('ambiguous', 'VOICE_PROVIDER_ERROR', message, res.status)
    const code = body.includes('voice_limit_reached')
      ? 'VOICE_LIMIT_REACHED'
      : 'VOICE_CREATE_REJECTED'
    throw new VoiceProviderError('permanent', code, message, res.status)
  }

  const json = (await res.json()) as { voice_id?: string; requires_verification?: boolean }
  if (!json.voice_id)
    throw new VoiceProviderError(
      'ambiguous',
      'VOICE_CREATE_NO_ID',
      'ElevenLabs returned no voice_id.',
    )
  return {
    providerVoiceId: json.voice_id,
    requiresVerification: json.requires_verification === true,
  }
}

/** GET /v1/voices/{id}: does the voice exist, and is it usable without verification? */
export const getVoiceReadiness = async (providerVoiceId: string): Promise<VoiceReadinessResult> => {
  const { apiKey, base, timeoutMs } = requireKey()
  let res: Response
  try {
    res = await fetch(`${base}/v1/voices/${encodeURIComponent(providerVoiceId)}`, {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw new VoiceProviderError(
      'retryable',
      'VOICE_NETWORK',
      err instanceof Error ? err.message : 'network error contacting ElevenLabs',
    )
  }
  if (res.status === 404) return { found: false, ready: false, requiresVerification: false }
  if (!res.ok) {
    const message = clip(`ElevenLabs voice ${res.status}: ${await res.text().catch(() => '')}`)
    const kind = res.status === 429 || res.status >= 500 ? 'retryable' : 'permanent'
    throw new VoiceProviderError(kind, 'VOICE_READINESS_FAILED', message, res.status)
  }
  // ponytail: verification shape per ElevenLabs voice object; confirm in the pilot (D5).
  const json = (await res.json()) as {
    voice_verification?: { requires_verification?: boolean; is_verified?: boolean }
  }
  const v = json.voice_verification
  const requiresVerification = v?.requires_verification === true && v?.is_verified !== true
  return { found: true, ready: !requiresVerification, requiresVerification }
}

/** Reconcile an uncertain create: exact-name lookup via GET /v2/voices?search=. */
export const findVoiceByName = async (name: string): Promise<string | null> => {
  const { apiKey, base, timeoutMs } = requireKey()
  let res: Response
  try {
    res = await fetch(`${base}/v2/voices?search=${encodeURIComponent(name)}&page_size=100`, {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw new VoiceProviderError(
      'retryable',
      'VOICE_NETWORK',
      err instanceof Error ? err.message : 'network error contacting ElevenLabs',
    )
  }
  if (!res.ok) {
    const message = clip(
      `ElevenLabs voice search ${res.status}: ${await res.text().catch(() => '')}`,
    )
    throw new VoiceProviderError('retryable', 'VOICE_LOOKUP_FAILED', message, res.status)
  }
  const json = (await res.json()) as { voices?: { voice_id: string; name: string }[] }
  return json.voices?.find((v) => v.name === name)?.voice_id ?? null
}

export const ELEVENLABS = {
  registerInstantVoice,
  getVoiceReadiness,
  findVoiceByName,
  /** Synthesize speech for an approved text from a ready voice. */
  generateSpeech,
}
