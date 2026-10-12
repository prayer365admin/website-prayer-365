import { languages } from '../../prisma/seeds/language'
import { DEFAULT_SITE_LOCALE, SITE_LOCALES, SITE_LOCALE_NAMES, isSiteLocale } from './site-locale'
import { describe, expect, it } from 'vitest'

describe('website language contract', () => {
  it('offers en/et/sv/fi, Swedish included', () => {
    expect([...SITE_LOCALES]).toEqual(['en', 'et', 'sv', 'fi'])
  })

  it('has a display name and a seeded row for every locale', () => {
    const seeded = languages.map((language) => language.code)

    for (const locale of SITE_LOCALES) {
      expect(SITE_LOCALE_NAMES[locale]).toBeTruthy()
      expect(seeded).toContain(locale)
    }
  })

  it('defaults to en and rejects unknown codes', () => {
    expect(DEFAULT_SITE_LOCALE).toBe('en')
    expect(isSiteLocale('sv')).toBe(true)
    expect(isSiteLocale('de')).toBe(false)
    expect(isSiteLocale(null)).toBe(false)
  })
})
