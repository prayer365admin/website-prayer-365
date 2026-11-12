import customSlugify from '@/utils/slugify'

/**
 * Churches created by `prisma/seeds/church.ts` (demo fixtures). Their prayers and
 * audio are approved like real content, so without this guard a seeded demo prayer
 * becomes the guest hero on /welcome and /login the moment the live database has no
 * playable prayer of its own.
 *
 * The seed derives its slugs from these same names (`prisma/seeds/church.ts`
 * `seedSlug(...)`), so this list is the single place a demo church is declared.
 */
export const DEMO_CHURCH_NAMES = [
  'Tallinn Demo Church',
  'Tartu Demo Church',
  "St. John's Church",
  "St. Olaf's Church",
  "Pärnu St. Elizabeth's Church",
] as const

export const DEMO_CHURCH_SLUGS: string[] = DEMO_CHURCH_NAMES.map((text) =>
  customSlugify({ text, isExists: false }),
)
