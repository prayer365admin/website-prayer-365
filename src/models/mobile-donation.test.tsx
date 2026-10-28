// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

// The module reads the origin list once at import time, so set it before the imports resolve.
vi.hoisted(() => {
  process.env.APP_LINK_ORIGINS = 'https://prayer-365.catatia.com, https://prayer365.eu/'
})

import {
  MobileBillingPortalRequestSchema,
  MobileDonationInitiateSchema,
  MobileDonationStatusQuerySchema,
  parseAppLinkOrigins,
} from './mobile-donation'

const start = { amountMinor: 2500, currency: 'EUR', frequency: 'one_time' as const }

describe('MobileDonationInitiateSchema', () => {
  it('accepts every configured app domain (staging and production) plus the Expo Go shape', () => {
    for (const origin of ['https://prayer-365.catatia.com', 'https://prayer365.eu']) {
      expect(
        MobileDonationInitiateSchema.safeParse({
          ...start,
          successUrl: `${origin}/donations/return?outcome=success`,
        }).success,
      ).toBe(true)
    }
    expect(
      MobileDonationInitiateSchema.safeParse({
        ...start,
        cancelUrl: 'exp://127.0.0.1:8081/--/donations/return?outcome=cancel',
      }).success,
    ).toBe(true)
  })

  it('still accepts the legacy app scheme, so builds made before the switch keep working', () => {
    expect(
      MobileDonationInitiateSchema.safeParse({
        ...start,
        successUrl: 'prayer-365://donations/return?outcome=success',
      }).success,
    ).toBe(true)
  })

  it('rejects another origin — the provider would redirect the giver off-app', () => {
    const result = MobileDonationInitiateSchema.safeParse({
      ...start,
      successUrl: 'https://evil.example/donations/return',
    })
    expect(result.success).toBe(false)
  })

  it('rejects our own origin on a path the app does not claim', () => {
    const result = MobileDonationInitiateSchema.safeParse({
      ...start,
      successUrl: 'https://prayer-365.catatia.com/admin/dashboard',
    })
    expect(result.success).toBe(false)
  })

  it('rejects the giver or the church travelling in the body', () => {
    expect(MobileDonationInitiateSchema.safeParse({ ...start, userId: 'u2' }).success).toBe(false)
    expect(MobileDonationInitiateSchema.safeParse({ ...start, churchId: 'c2' }).success).toBe(false)
  })

  it('rejects a non-positive amount and an amount above the cap', () => {
    expect(MobileDonationInitiateSchema.safeParse({ ...start, amountMinor: 0 }).success).toBe(false)
    expect(
      MobileDonationInitiateSchema.safeParse({ ...start, amountMinor: 100_000_001 }).success,
    ).toBe(false)
  })
})

describe('MobileDonationStatusQuerySchema', () => {
  it('coerces the string query values it receives from the URL', () => {
    const parsed = MobileDonationStatusQuerySchema.parse({
      sessionId: 'cs_1',
      churchId: 'c1',
      amountMinor: '2500',
      currency: 'EUR',
      frequency: 'monthly',
    })
    expect(parsed.amountMinor).toBe(2500)
    expect(parsed.currency).toBe('eur')
  })

  it('requires the sessionId — the attempt is read by tuple, never by a bare church', () => {
    expect(
      MobileDonationStatusQuerySchema.safeParse({
        churchId: 'c1',
        amountMinor: '2500',
        currency: 'EUR',
        frequency: 'monthly',
      }).success,
    ).toBe(false)
  })
})

describe('MobileBillingPortalRequestSchema', () => {
  it('accepts the universal-link return and rejects another origin', () => {
    expect(
      MobileBillingPortalRequestSchema.safeParse({
        returnUrl: 'https://prayer-365.catatia.com/donations/return?outcome=manage',
      }).success,
    ).toBe(true)
    expect(
      MobileBillingPortalRequestSchema.safeParse({ returnUrl: 'https://evil.example/portal' })
        .success,
    ).toBe(false)
  })

  it('rejects unknown keys', () => {
    expect(
      MobileBillingPortalRequestSchema.safeParse({
        returnUrl: 'https://prayer-365.catatia.com/donations/return',
        customerId: 'cus_1',
      }).success,
    ).toBe(false)
  })
})

describe('parseAppLinkOrigins', () => {
  it('splits on commas, trims spaces, drops blanks and trailing slashes', () => {
    expect(parseAppLinkOrigins(' https://a.test/ , ,https://b.test ')).toEqual([
      'https://a.test',
      'https://b.test',
    ])
  })

  it('returns an empty list when the env var is unset or blank', () => {
    expect(parseAppLinkOrigins(undefined)).toEqual([])
    expect(parseAppLinkOrigins('  ')).toEqual([])
  })
})

describe('exp:// is a development-only return shape', () => {
  const cancelUrl = 'exp://127.0.0.1:8081/--/donations/return?outcome=cancel'

  it('rejects Expo Go when APP_ENV is PROD', async () => {
    vi.resetModules()
    vi.stubEnv('APP_ENV', 'PROD')
    const prod = await import('./mobile-donation')
    expect(prod.MobileDonationInitiateSchema.safeParse({ ...start, cancelUrl }).success).toBe(false)
    vi.unstubAllEnvs()
    vi.resetModules()
  })
})
