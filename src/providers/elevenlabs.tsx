import { NotImplementedError } from '@/utils/not-implemented-error'

/*
 * ElevenLabs external-service adapter stub (SPEC 9.3.1 / plan Task 45).
 *
 * This is the SEAM the Phase 10 voice-registration/audio worker will fill.
 * Until that deliverable lands, every method THROWS a NotImplementedError and
 * never returns a value that looks like success. The feature is additionally
 * gated behind ELEVENLABS_ENABLED so an accidental call outside the worker
 * can never silently no-op.
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

/** Feature flag: true only when the Phase 10 integration is enabled. */
export const isElevenLabsEnabled = () => process.env.ELEVENLABS_ENABLED === 'true'

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
export interface SpeechResult {
  providerRequestId: string
  assetId: string
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
  async generateSpeech(_req: SpeechRequest): Promise<SpeechResult> {
    ensureEnabled('generateSpeech')
    return pending('generateSpeech')
  },
}
