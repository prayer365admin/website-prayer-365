import { describe, expect, it } from 'vitest'

import {
  MAX_WEBHOOK_EVENTS,
  REQUIRED_WEBHOOK_EVENTS,
  assertKeyMode,
  buildProdEnvBlock,
  findEndpoint,
  keyMode,
  maskSecret,
  mergeEvents,
  missingEvents,
  normalizeEndpointUrl,
} from './stripe-migrate-rules'

const endpoints = [
  {
    id: 'we_1',
    url: 'https://www.prayer365.eu/api/v1/webhooks/stripe/',
    enabled_events: ['charge.succeeded'],
  },
  { id: 'we_2', url: 'https://Staging.Prayer365.eu/api/v1/webhooks/stripe', enabled_events: [] },
]

describe('keyMode', () => {
  it('accepts test and live secret keys, including restricted ones', () => {
    expect(keyMode('sk_test_abc123')).toBe('test')
    expect(keyMode('sk_live_abc123')).toBe('live')
    expect(keyMode('rk_live_abc123')).toBe('live')
  })

  it('rejects a publishable key or a truncated value', () => {
    expect(keyMode('pk_test_abc123')).toBeNull()
    expect(keyMode('sk_test')).toBeNull()
  })
})

describe('assertKeyMode', () => {
  it('refuses a live key where a test key is expected, and names the label', () => {
    expect(() => assertKeyMode('staging key', 'sk_live_abc123', 'test')).toThrow(
      /staging key is a live key/,
    )
  })

  it('refuses a value that is not a secret key at all', () => {
    expect(() => assertKeyMode('prod key', 'whsec_abc', 'live')).toThrow(/not a Stripe secret key/)
  })

  it('passes the matching mode', () => {
    expect(() => assertKeyMode('prod key', 'sk_live_abc123', 'live')).not.toThrow()
  })
})

describe('normalizeEndpointUrl', () => {
  it('ignores a trailing slash and host case', () => {
    expect(normalizeEndpointUrl('https://WWW.Prayer365.eu/api/v1/webhooks/stripe/')).toBe(
      'https://www.prayer365.eu/api/v1/webhooks/stripe',
    )
  })

  it('keeps a query string', () => {
    expect(normalizeEndpointUrl('https://a.test/hook?x=1')).toBe('https://a.test/hook?x=1')
  })
})

describe('findEndpoint', () => {
  it('matches despite a trailing slash so a re-run does not create a duplicate', () => {
    expect(findEndpoint(endpoints, 'https://www.prayer365.eu/api/v1/webhooks/stripe')?.id).toBe(
      'we_1',
    )
  })

  it('is case-insensitive on the host', () => {
    expect(findEndpoint(endpoints, 'https://staging.prayer365.eu/api/v1/webhooks/stripe')?.id).toBe(
      'we_2',
    )
  })

  it('returns undefined when the path differs', () => {
    expect(findEndpoint(endpoints, 'https://www.prayer365.eu/hooks/stripe')).toBeUndefined()
  })
})

describe('missingEvents', () => {
  it('lists required events the endpoint does not listen to', () => {
    expect(missingEvents(['charge.succeeded'])).not.toContain('charge.succeeded')
    expect(missingEvents(['charge.succeeded'])).toContain('payment_intent.succeeded')
    expect(missingEvents(REQUIRED_WEBHOOK_EVENTS)).toEqual([])
  })

  it('treats an undefined list as empty', () => {
    expect(missingEvents(undefined).length).toBe(REQUIRED_WEBHOOK_EVENTS.length)
  })
})

describe('mergeEvents', () => {
  it('unions required and inherited events without duplicates', () => {
    const merged = mergeEvents(['charge.succeeded', 'customer.created'])
    expect(merged[0]).toBe('payment_intent.succeeded')
    expect(merged.filter((event) => event === 'charge.succeeded').length).toBe(1)
    expect(merged).toContain('customer.created')
  })

  it('stays inside the Stripe event cap', () => {
    expect(REQUIRED_WEBHOOK_EVENTS.length).toBeLessThanOrEqual(MAX_WEBHOOK_EVENTS)
  })
})

describe('maskSecret', () => {
  it('keeps only the prefix and last four characters', () => {
    expect(maskSecret('whsec_abcdefghijklmn')).toBe('whsec_ab…klmn')
  })

  it('fully masks a short value', () => {
    expect(maskSecret('abc')).toBe('***')
  })
})

describe('buildProdEnvBlock', () => {
  it('emits the four prod keys with the live webhook secret', () => {
    const block = buildProdEnvBlock({
      secretKey: 'sk_live_abc',
      webhookSecret: 'whsec_abc',
      accountId: 'acct_1',
    })
    expect(block).toContain('STRIPE_ENABLED=true')
    expect(block).toContain('STRIPE_SECRET_KEY=sk_live_abc')
    expect(block).toContain('STRIPE_WEBHOOK_SECRET=whsec_abc')
    expect(block).toContain('STRIPE_PLATFORM_ACCOUNT_ID=acct_1')
  })
})
