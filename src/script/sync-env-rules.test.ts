import { describe, expect, it } from 'vitest'

import {
  diffEnv,
  guessTargetEnvironment,
  hasWrites,
  maskValue,
  parseEnvText,
} from './sync-env-rules'

describe('diffEnv', () => {
  it('reports nothing when both sides agree', () => {
    const diff = diffEnv({
      local: { A: '1', B: 'two' },
      host: { A: '1', B: 'two' },
      hostKeys: ['A', 'B'],
    })

    expect(hasWrites(diff)).toBe(false)
    expect(diff.missing).toEqual([])
    expect(diff.different).toEqual([])
    expect(diff.hostOnly).toEqual([])
  })

  it('sorts a local-only key into missing', () => {
    const diff = diffEnv({
      local: { APP_LINK_ORIGINS: 'https://prayer-365.catatia.com' },
      host: {},
      hostKeys: [],
    })

    expect(diff.missing).toEqual(['APP_LINK_ORIGINS'])
    expect(hasWrites(diff)).toBe(true)
  })

  it('reports a value mismatch with both sides', () => {
    const diff = diffEnv({
      local: { STRIPE_ENABLED: 'true' },
      host: { STRIPE_ENABLED: 'false' },
      hostKeys: ['STRIPE_ENABLED'],
    })

    expect(diff.different).toEqual([{ key: 'STRIPE_ENABLED', local: 'true', host: 'false' }])
    expect(diff.missing).toEqual([])
  })

  it('never mirrors a host-only key into the local file', () => {
    const diff = diffEnv({
      local: { A: '1' },
      host: { A: '1', ROTATED_KEY: 'x' },
      hostKeys: ['A', 'ROTATED_KEY'],
    })

    expect(diff.hostOnly).toEqual(['ROTATED_KEY'])
    expect(hasWrites(diff)).toBe(false)
  })

  it('skips a blank local value instead of blanking the host', () => {
    const diff = diffEnv({
      local: { SECRET: '', OTHER: '   ' },
      host: { SECRET: 'live' },
      hostKeys: ['SECRET'],
    })

    expect(diff.empty).toEqual(['SECRET', 'OTHER'])
    expect(diff.missing).toEqual([])
    expect(diff.different).toEqual([])
    expect(hasWrites(diff)).toBe(false)
  })

  it('treats an unreadable host key as "cannot verify", not as missing', () => {
    const diff = diffEnv({
      local: { SENSITIVE_TOKEN: 'local-value' },
      host: {},
      hostKeys: ['SENSITIVE_TOKEN'],
    })

    expect(diff.unverifiable).toEqual(['SENSITIVE_TOKEN'])
    expect(diff.missing).toEqual([])
    expect(hasWrites(diff)).toBe(false)
  })

  it('treats the [SENSITIVE] placeholder as unverifiable by default', () => {
    const diff = diffEnv({
      local: { SECRET_TOKEN: 'local-value' },
      host: { SECRET_TOKEN: '[SENSITIVE]' },
      hostKeys: ['SECRET_TOKEN'],
    })

    expect(diff.unverifiable).toEqual(['SECRET_TOKEN'])
    expect(diff.different).toEqual([])
    expect(hasWrites(diff)).toBe(false)
  })

  it('rewrites the [SENSITIVE] placeholder only when explicitly asked', () => {
    const diff = diffEnv({
      local: { SECRET_TOKEN: 'local-value' },
      host: { SECRET_TOKEN: '[SENSITIVE]' },
      hostKeys: ['SECRET_TOKEN'],
      rewriteSensitive: true,
    })

    expect(diff.unverifiable).toEqual([])
    expect(diff.different).toEqual([
      { key: 'SECRET_TOKEN', local: 'local-value', host: '[SENSITIVE]' },
    ])
  })
})

describe('maskValue', () => {
  it('keeps a long secret recognisable but not reusable', () => {
    const masked = maskValue('sk_live_1234567890abcdef')

    expect(masked).toBe('sk_l…ef (24 chars)')
    expect(masked).not.toContain('1234567890')
  })

  it('fully hides a short value', () => {
    expect(maskValue('abc')).toBe('*** (3 chars)')
    expect(maskValue('')).toBe('(empty)')
  })
})

describe('guessTargetEnvironment', () => {
  it('maps production, development and the plain local file', () => {
    expect(guessTargetEnvironment('.env.prod')).toBe('production')
    expect(guessTargetEnvironment('.env.production.local')).toBe('production')
    expect(guessTargetEnvironment('.env.development')).toBe('development')
    expect(guessTargetEnvironment('.env')).toBe('preview')
  })
})

describe('parseEnvText', () => {
  it('strips quotes and comments so the diff compares values, not raw text', () => {
    const parsed = parseEnvText('# comment\nA="quoted value"\nB=plain\nC=\n')

    expect(parsed).toEqual({ A: 'quoted value', B: 'plain', C: '' })
  })
})
