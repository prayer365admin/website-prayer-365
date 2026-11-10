import type { SiteLoginPrayer } from '@/models/site-prayer'

/**
 * Guest hero prayer for /welcome and /login.
 *
 * Static by owner decision: the live database still has no published prayer with
 * approved audio, so the newest-playable query would only surface seeded demo
 * content. This is a real church prayer — Viimsi St James' Church, sermon
 * "Tänulikkus" (2 September 2018), pastor Mikk Leedjärv — with its approved
 * audio copied out of the staging media library into `public/audio/`.
 *
 * Replace with a database prayer (or delete) once a published live prayer has
 * approved audio of its own.
 */
export const FEATURED_WELCOME_PRAYER: SiteLoginPrayer = {
  id: 'featured-tanulikkus',
  title: 'Tänulikkus',
  churchName: "Viimsi St James' Church",
  pastorName: 'Mikk Leedjärv',
  languageCode: 'et',
  audioUrl: '/audio/tanulikkus.mp3',
  introduction: 'Viimsi Püha Jaakobi koguduse jutlus • 2. september 2018',
  churchCoverUrl: '/images/viimsi-st-james-church.jpg',
}
