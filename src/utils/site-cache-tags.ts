/**
 * Cache tags for website content that every visitor sees the same way.
 *
 * Kept in a dependency-free module so the data providers can import the tag
 * without pulling `next/cache` into their module graph (and into unit tests).
 */
export const SITE_PUBLIC_TAG = 'site-public'

/**
 * Backstop TTL for the public site cache. `revalidateTag(SITE_PUBLIC_TAG)` is
 * what makes a published edit visible at once; this only stops stale content
 * living forever.
 *
 * Tunable through SITE_PUBLIC_CACHE_SECONDS (default 60) because every expired
 * key re-queries the database: a crawler walking the church directory expires
 * dozens of keys inside a minute, and each miss costs a DB round trip.
 */
const configuredCacheSeconds = Number(process.env.SITE_PUBLIC_CACHE_SECONDS)

export const SITE_PUBLIC_REVALIDATE_SECONDS =
  Number.isFinite(configuredCacheSeconds) && configuredCacheSeconds > 0
    ? configuredCacheSeconds
    : 60
