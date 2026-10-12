/**
 * Website interface languages (WF1 / SPEC §5.1).
 *
 * Every code here must exist as a row in `languages`, because `User.locale` is
 * a foreign key to `languages.code`. Seeded in prisma/seeds/language.ts.
 */
export const SITE_LOCALES = ['en', 'et', 'sv', 'fi'] as const

export type SiteLocale = (typeof SITE_LOCALES)[number]

export const SITE_LOCALE_NAMES: Record<SiteLocale, string> = {
  en: 'English',
  et: 'Eesti',
  sv: 'Svenska',
  fi: 'Suomi',
}

export const DEFAULT_SITE_LOCALE: SiteLocale = 'en'

/** Cookie that remembers the UI language before it is saved to User.locale (WB-16). */
export const SITE_LOCALE_COOKIE = 'site_locale'

export const isSiteLocale = (value: string | null | undefined): value is SiteLocale =>
  !!value && (SITE_LOCALES as readonly string[]).includes(value)
