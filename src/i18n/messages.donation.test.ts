import { describe, expect, it } from 'vitest'
import { SITE_LOCALES } from '@/config/site-locale'
import { SITE_MESSAGES } from './messages'

/**
 * WB4 donations (W11 / W12). The donate and result screens are new, so their
 * keys must exist in every locale instead of silently falling back to English.
 */
describe('SITE_MESSAGES — WB4 donation keys', () => {
  const donationKeys = Object.keys(SITE_MESSAGES.en).filter((key) => /^donate/.test(key)) as Array<
    keyof (typeof SITE_MESSAGES)['en']
  >

  it('covers both screens', () => {
    expect(donationKeys.length).toBeGreaterThan(60)
    expect(donationKeys.some((key) => key.startsWith('donateResult'))).toBe(true)
    expect(donationKeys.some((key) => key.startsWith('donate'))).toBe(true)
  })

  it('is present in all four locales', () => {
    SITE_LOCALES.forEach((locale) => {
      const block = SITE_MESSAGES[locale] as Record<string, string>
      donationKeys.forEach((key) => {
        expect(block[key], `${locale} is missing ${key}`).toBeTruthy()
      })
    })
  })

  it('keeps the same interpolation placeholders as English', () => {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort()
    SITE_LOCALES.filter((locale) => locale !== 'en').forEach((locale) => {
      const block = SITE_MESSAGES[locale] as Record<string, string>
      donationKeys.forEach((key) => {
        expect(placeholders(block[key]), `${locale}.${key} placeholders`).toEqual(
          placeholders(SITE_MESSAGES.en[key]),
        )
      })
    })
  })
})
