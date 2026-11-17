import { describe, expect, it } from 'vitest'
import { SITE_LOCALES } from '@/config/site-locale'
import { SITE_MESSAGES } from './messages'

/**
 * PD4 public giving (`/give`). The page is reachable without an account, so its
 * copy must exist in every locale instead of silently falling back to English.
 */
describe('SITE_MESSAGES — public giving keys', () => {
  const publicGiveKeys = Object.keys(SITE_MESSAGES.en).filter((key) =>
    /^publicGive/.test(key),
  ) as Array<keyof (typeof SITE_MESSAGES)['en']>

  it('covers the form, the trust strip and every thank-you state', () => {
    expect(publicGiveKeys).toContain('publicGiveBeneficiaryNotice')
    expect(publicGiveKeys).toContain('publicGiveOneTimeOnly')
    expect(publicGiveKeys).toContain('publicGiveThanksEmailNotice')
    expect(publicGiveKeys).toContain('publicGivePendingTitle')
    expect(publicGiveKeys).toContain('publicGiveFailedTitle')
    expect(publicGiveKeys.length).toBeGreaterThanOrEqual(24)
  })

  it('does not collide with the existing give* keys', () => {
    expect(Object.keys(SITE_MESSAGES.en).some((key) => key === 'giveViaBanklink')).toBe(true)
    expect(publicGiveKeys).not.toContain('giveViaBanklink' as never)
  })

  it('is present in all four locales', () => {
    SITE_LOCALES.forEach((locale) => {
      const block = SITE_MESSAGES[locale] as Record<string, string>
      publicGiveKeys.forEach((key) => {
        expect(block[key], `${locale} is missing ${key}`).toBeTruthy()
      })
    })
  })

  it('keeps the same interpolation placeholders as English', () => {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort()
    SITE_LOCALES.filter((locale) => locale !== 'en').forEach((locale) => {
      const block = SITE_MESSAGES[locale] as Record<string, string>
      publicGiveKeys.forEach((key) => {
        expect(placeholders(block[key]), `${locale}.${key} placeholders`).toEqual(
          placeholders(SITE_MESSAGES.en[key]),
        )
      })
    })
  })
})
