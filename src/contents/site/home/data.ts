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
  /** Singular form of `link`, used when the count is 1. */
  linkOne?: SiteMessageKey
  /** null = the feature does not exist yet; the card renders as "Coming soon". */
  href: string | null
}

// Static home-2 shortcut cards. The prayer link interpolates {count} (/prayers archive total);
// other copy follows the design until a live source exists.
export const HOME_SHORTCUTS: HomeShortcut[] = [
  {
    id: 'daily-prayer',
    icon: '/icons/icon-sun-bright.svg',
    tileClassName: 'bg-primary-500',
    iconClassName: 'bg-white',
    title: 'homeShortcutPrayerTitle',
    body: 'homeShortcutPrayerBody',
    link: 'homeShortcutPrayerLink',
    linkOne: 'homeShortcutPrayerLinkOne',
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
    href: '#prayer-petition',
  },
]

/** Shared white card surface for Home section cards. */
export const homeCardClassName = 'rounded-2xl bg-white shadow-[0_8px_30px_rgba(24,74,140,0.08)]'
export const homeCardThinShadowClassName =
  'rounded-2xl bg-white shadow-[0_1px_2px_0px_rgba(24,74,140,0.08)]'

/** Ring targets: a full week with prayer listening, and an hour of prayer audio a week. */
export const HOME_HABIT_GOALS = { streakDays: 7, minutesThisWeek: 60 }

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
