/**
 * Cache tags for website content that every visitor sees the same way.
 *
 * Kept in a dependency-free module so the data providers can import the tag
 * without pulling `next/cache` into their module graph (and into unit tests).
 */
export const SITE_PUBLIC_TAG = 'site-public'
