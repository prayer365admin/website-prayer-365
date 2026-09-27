// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ELEVENLABS } from './elevenlabs'
import { STRIPE } from './stripe'
import { NotImplementedError } from '@/utils/not-implemented-error'

/*
 * Phase 10 external-service adapter stubs must THROW a NotImplementedError and
 * never silently return a success-looking value (SPEC 9.6 / 9.3.1, plan 45).
 */
describe('external provider adapters are idle pending stubs', () => {
  it.each([
    ['ELEVENLABS.registerInstantVoice', () => ELEVENLABS.registerInstantVoice({} as never)],
    ['ELEVENLABS.getVoiceReadiness', () => ELEVENLABS.getVoiceReadiness('voice_1')],
    ['ELEVENLABS.generateSpeech', () => ELEVENLABS.generateSpeech({} as never)],
    ['STRIPE.createCheckoutSession', () => STRIPE.createCheckoutSession({} as never)],
    ['STRIPE.constructWebhookEvent', () => STRIPE.constructWebhookEvent('{raw}', 'sig')],
  ])('%s throws NotImplementedError, never silently succeeds', async (_name, call) => {
    const err = await call().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(NotImplementedError)
    expect((err as Error).message).toMatch(/external integration pending/)
  })

  it('errors carry the NotImplementedError name', async () => {
    const err = await STRIPE.createCheckoutSession({} as never).catch((e: unknown) => e)
    expect((err as Error).name).toBe('NotImplementedError')
  })
})
