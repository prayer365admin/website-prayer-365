import { SiteMessageKey } from '@/i18n/messages'

/**
 * Static structure for the /welcome landing page (Figma node 87-8752).
 *
 * Copy lives in `src/i18n/messages.ts` under `welcome*` keys so every locale
 * renders translated text. This module only maps the layout order to those keys.
 *
 * Per SPEC:
 * - Real data is used when available via existing server controllers (audio prayer, member count).
 * - When an API exists but returns null, render "Data not available" / "No open prayer available yet."
 * - Where no API exists (church chips, testimonials, static marketing copy, schedule blocks),
 *   this registry supplies the exact Figma design strings via message keys.
 */

/** Proper parish names — not translated. */
export const CHURCH_NETWORK_CHIPS = [
  "St. John's Church, Tallinn",
  "St. Michael's Swedish Parish",
  'Helsinki Old Church & Coast Deanery',
  "St. Peter's Congregation, Tartu",
  'Riga Dome Cathedral Partner Fellowship',
]

export interface ScheduleBlock {
  titleKey: SiteMessageKey
  timeKey: SiteMessageKey
}

export const LITURGY_SCHEDULE_BLOCKS: ScheduleBlock[] = [
  { titleKey: 'welcomeScheduleMatins', timeKey: 'welcomeScheduleMatinsTime' },
  { titleKey: 'welcomeScheduleAngelus', timeKey: 'welcomeScheduleAngelusTime' },
  { titleKey: 'welcomeScheduleCompline', timeKey: 'welcomeScheduleComplineTime' },
]

export interface AppFeature {
  titleKey: SiteMessageKey
  hintKey: SiteMessageKey
}

export const APP_FEATURES: AppFeature[] = [
  { titleKey: 'welcomeAppFeature1Title', hintKey: 'welcomeAppFeature1Hint' },
  { titleKey: 'welcomeAppFeature2Title', hintKey: 'welcomeAppFeature2Hint' },
  { titleKey: 'welcomeAppFeature3Title', hintKey: 'welcomeAppFeature3Hint' },
  { titleKey: 'welcomeAppFeature4Title', hintKey: 'welcomeAppFeature4Hint' },
]

export interface Testimonial {
  quoteKey: SiteMessageKey
  /** Proper name — not translated. */
  author: string
  roleKey: SiteMessageKey
  avatarUrl: string
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quoteKey: 'welcomeTestimonial1Quote',
    author: 'Rev. Thomas Lindqvist',
    roleKey: 'welcomeTestimonial1Role',
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces&auto=format&q=80',
  },
  {
    quoteKey: 'welcomeTestimonial2Quote',
    author: 'Diaconal Sister Kristiina',
    roleKey: 'welcomeTestimonial2Role',
    avatarUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces&auto=format&q=80',
  },
  {
    quoteKey: 'welcomeTestimonial3Quote',
    author: 'Mart Tamm',
    roleKey: 'welcomeTestimonial3Role',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces&auto=format&q=80',
  },
]

export interface MosaicTile {
  eyebrowKey: SiteMessageKey
  titleKey: SiteMessageKey
  descriptionKey: SiteMessageKey
  imageSrc: string
}

export const MOSAIC_TILES: MosaicTile[] = [
  {
    eyebrowKey: 'welcomeMosaic1Eyebrow',
    titleKey: 'welcomeMosaic1Title',
    descriptionKey: 'welcomeMosaic1Body',
    imageSrc: '/images/church.jpeg',
  },
  {
    eyebrowKey: 'welcomeMosaic2Eyebrow',
    titleKey: 'welcomeMosaic2Title',
    descriptionKey: 'welcomeMosaic2Body',
    imageSrc: '/images/viimsi-church-indoor.jpeg',
  },
  {
    eyebrowKey: 'welcomeMosaic3Eyebrow',
    titleKey: 'welcomeMosaic3Title',
    descriptionKey: 'welcomeMosaic3Body',
    imageSrc: '/images/wb3-devotional-lake.png',
  },
]

export const PASTOR_AVATARS = [
  '/images/pastor-1.jpg',
  '/images/pastor-2.jpg',
  '/images/pastor-3.jpg',
]

export const SCRIPTURE_BLESSING = {
  quoteKey: 'welcomeScriptureQuote',
  attributionKey: 'welcomeScriptureAttribution',
} as const satisfies Record<string, SiteMessageKey>

/** Hotline number is a constant; the labels around it are translated. */
export const FOOTER_HOTLINE = '+372 644 1483'

export const FOOTER_DATA = {
  parishLinks: [
    { key: 'welcomeFooterLinkTallinn', href: '/churches' },
    { key: 'welcomeFooterLinkHelsinki', href: '/churches' },
    { key: 'welcomeFooterLinkFund', href: '/donate' },
    { key: 'welcomeFooterLinkYouth', href: '/prayers' },
  ],
  legalLinks: [
    { key: 'welcomeFooterPrivacy', href: '/privacy' },
    { key: 'welcomeFooterTerms', href: '/terms' },
    { key: 'welcomeFooterSupport', href: '/support' },
  ],
} as const satisfies Record<string, { key: SiteMessageKey; href: string }[]>
