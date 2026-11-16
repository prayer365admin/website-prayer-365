/**
 * The platform beneficiary: Prayer 365 itself.
 *
 * A guest gift (`/give`) is always addressed to the platform, never to a parish,
 * so this is the single place the beneficiary identity, its URL slugs and the
 * amount ladder are defined. The seed, the public controller and the public page
 * all import from here — a literal repeated elsewhere would let the seeded row and
 * the lookup drift apart.
 *
 * No env vars: the row is resolved by `PLATFORM_CHURCH_SLUG` at runtime, so one
 * deploy artefact stays valid in staging and production (their row ids differ).
 */
export const PLATFORM_CHURCH_SLUG = 'prayer365'
export const PLATFORM_CHURCH_NAME = 'Prayer 365'
export const PLATFORM_CHURCH_TIMEZONE = 'Europe/Tallinn'

export const PLATFORM_DONATION_CURRENCY = 'EUR'
/** 5 / 10 / 25 / 50 EUR, in minor units. */
export const PLATFORM_DONATION_PRESETS_MINOR = [500, 1000, 2500, 5000]
export const PLATFORM_DONATION_MIN_MINOR = 100 // 1 EUR
export const PLATFORM_DONATION_MAX_MINOR = 500_000 // 5,000 EUR

export const PLATFORM_GIVE_PATH = '/give'
export const PLATFORM_GIVE_THANKS_PATH = '/donate/result'
