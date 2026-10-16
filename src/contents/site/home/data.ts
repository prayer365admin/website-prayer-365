import { SiteMessageKey } from '@/i18n/messages'

export type HomeShortcut = {
  id: string
  icon: string
  /** Icon tile background and icon colour. */
  tileClassName: string
  iconClassName: string
  title: SiteMessageKey
  body: SiteMessageKey
  link: SiteMessageKey
  /** null = the feature does not exist yet; the card renders as "Coming soon". */
  href: string | null
}

// Static home-2 shortcut cards. Copy follows the design for now; swap a message key for live data
// (e.g. a session or church count) here once a source exists.
export const HOME_SHORTCUTS: HomeShortcut[] = [
  {
    id: 'daily-prayer',
    icon: '/icons/icon-sun-bright.svg',
    tileClassName: 'bg-primary-500',
    iconClassName: 'bg-white',
    title: 'homeShortcutPrayerTitle',
    body: 'homeShortcutPrayerBody',
    link: 'homeShortcutPrayerLink',
    href: '/prayers',
  },
  {
    id: 'find-churches',
    icon: '/icons/icon-church-2.svg',
    tileClassName: 'bg-primary-300',
    iconClassName: 'bg-white',
    title: 'homeShortcutChurchesTitle',
    body: 'homeShortcutChurchesBody',
    link: 'homeShortcutChurchesLink',
    href: '/churches',
  },
  {
    id: 'sunday-services',
    icon: '/icons/Icon-play-square.svg',
    tileClassName: 'bg-[#D5F7EE]',
    iconClassName: 'bg-primary-500',
    title: 'homeShortcutServicesTitle',
    body: 'homeShortcutServicesBody',
    link: 'homeShortcutServicesLink',
    href: null,
  },
  {
    id: 'request-prayer',
    icon: '/icons/icon-prayer-love.svg',
    tileClassName: 'bg-danger-200',
    iconClassName: 'bg-[#E64C4C]',
    title: 'homeShortcutRequestTitle',
    body: 'homeShortcutRequestBody',
    link: 'homeShortcutRequestLink',
    href: null,
  },
]

/** Shared white card surface for Home section cards. */
export const homeCardClassName = 'rounded-2xl bg-white shadow-[0_8px_30px_rgba(24,74,140,0.08)]'

// Spiritual Habits figures follow the design until prayer/listening tracking exists.
export const HOME_HABITS = { daysInPrayer: 7, daysGoal: 7, minutesThisWeek: 48, minutesGoal: 60 }

export const PETITION_INTENTIONS: SiteMessageKey[] = [
  'homeIntentionHealing',
  'homeIntentionGuidance',
  'homeIntentionFamily',
  'homeIntentionThanksgiving',
]

export const EVENT_CATEGORY_LABELS: Record<string, SiteMessageKey> = {
  SERVICE: 'homeEventService',
  SPECIAL: 'homeEventSpecial',
  BIBLE_STUDY: 'homeEventBibleStudy',
  COMMUNITY: 'homeEventCommunity',
  OTHER: 'homeEventOther',
}
