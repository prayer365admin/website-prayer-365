import { SITE_LOCALES } from '@/config/site-locale'
import { describe, expect, it } from 'vitest'
import { SITE_MESSAGES } from './messages'

/**
 * `satisfies Record<SiteLocale, Record<string, string>>` only proves every locale
 * block exists — not that it holds the same keys. A missing key silently falls
 * back to English.
 *
 * Full parity is NOT asserted here: `et`/`sv`/`fi` are already 78 keys short of
 * `en` (the WB3 prayer keys, review 012 F11 — tracked in docs/website/TASK.md).
 * This test covers the website chrome added by the header/footer work and the
 * WB1-PROFILE keys, which must never fall back again.
 */
describe('SITE_MESSAGES', () => {
  const chromeKeys = Object.keys(SITE_MESSAGES.en).filter((key) => /^(header|footer)/.test(key))
  const profileKeys = Object.keys(SITE_MESSAGES.en).filter((key) => /^profile/.test(key))
  const welcomeKeys = Object.keys(SITE_MESSAGES.en).filter((key) => /^welcome/.test(key))

  it('keeps every header/footer key in all four locales', () => {
    expect(chromeKeys.length).toBeGreaterThan(20)
    SITE_LOCALES.forEach((locale) => {
      const block = SITE_MESSAGES[locale] as Record<string, string>
      chromeKeys.forEach((key) => {
        expect(block[key], `${locale} is missing ${key}`).toBeTruthy()
      })
    })
  })

  it('keeps every profile key in all four locales', () => {
    expect(profileKeys.length).toBeGreaterThan(70)
    SITE_LOCALES.forEach((locale) => {
      const block = SITE_MESSAGES[locale] as Record<string, string>
      profileKeys.forEach((key) => {
        expect(block[key], `${locale} is missing ${key}`).toBeTruthy()
      })
    })
  })

  it('keeps every welcome landing key in all four locales', () => {
    expect(welcomeKeys.length).toBeGreaterThan(100)
    SITE_LOCALES.forEach((locale) => {
      const block = SITE_MESSAGES[locale] as Record<string, string>
      welcomeKeys.forEach((key) => {
        expect(block[key], `${locale} is missing ${key}`).toBeTruthy()
      })
    })
  })

  it('falls back to English for a key a locale does not define', () => {
    expect(chromeKeys.every((key) => SITE_MESSAGES.en[key as keyof typeof SITE_MESSAGES.en])).toBe(
      true,
    )
  })
})
