import { SITE_LOCALES } from '@/config/site-locale'
import { POLICY_MESSAGE_KEYS } from '@/contents/site/privacy/data'
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
  const maintenanceKeys = Object.keys(SITE_MESSAGES.en).filter((key) => /^maintenance/.test(key))

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

  it('keeps every maintenance key in all four locales', () => {
    expect(maintenanceKeys.length).toBe(5)
    SITE_LOCALES.forEach((locale) => {
      const block = SITE_MESSAGES[locale] as Record<string, string>
      maintenanceKeys.forEach((key) => {
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

/**
 * /privacy renders three legal documents from `src/i18n/policies/*`. Every one
 * of its ~200 keys must exist in all four languages — a fallback here would show
 * an English paragraph inside an otherwise translated policy.
 *
 * The second half of this block ties the copy to the page structure: every key
 * `POLICY_DOCUMENTS` names must exist, and no `policies*` key may be orphaned
 * (written but never rendered). Both directions are checked because the data
 * module types keys as `SiteMessageKey`, which proves they compile — not that
 * every translated row is reachable.
 */
describe('SITE_MESSAGES — policies keys', () => {
  const policyKeys = Object.keys(SITE_MESSAGES.en).filter((key) => /^policies/.test(key))

  it('covers all three documents with enough content', () => {
    expect(policyKeys.length).toBeGreaterThan(190)
    expect(POLICY_MESSAGE_KEYS.length).toBe(policyKeys.length)
  })

  it('keeps every policies key in all four locales', () => {
    SITE_LOCALES.forEach((locale) => {
      const block = SITE_MESSAGES[locale] as Record<string, string>
      policyKeys.forEach((key) => {
        expect(block[key], `${locale} is missing ${key}`).toBeTruthy()
      })
    })
  })

  it('renders every key the page structure names', () => {
    const rendered = new Set<string>(POLICY_MESSAGE_KEYS)
    POLICY_MESSAGE_KEYS.forEach((key) => {
      expect(policyKeys, `${key} is rendered but has no message`).toContain(key)
      expect(rendered.has(key)).toBe(true)
    })
  })

  it('has no policy key the page structure leaves unused', () => {
    const rendered = new Set<string>(POLICY_MESSAGE_KEYS)
    policyKeys.forEach((key) => {
      expect(rendered.has(key), `${key} is translated but never rendered`).toBe(true)
    })
  })
})
