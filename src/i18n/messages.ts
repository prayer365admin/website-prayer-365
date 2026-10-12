import { SiteLocale } from '@/config/site-locale'

/**
 * Website UI strings (WF1). Keys are flat and ASCII so later features just add
 * rows. Mobile translations are NOT imported here — the website owns its copy.
 */
export const SITE_MESSAGES = {
  en: {
    brand: 'PRAYER',
    language: 'Language',
    account: 'Account',
    signOut: 'Sign out',
    about: 'About',
    contact: 'Contact',
    privacy: 'Privacy',
    platformCredit: 'Prayer 365 — a Prayer platform.',
    loading: 'Loading…',
    empty: 'Nothing here yet.',
    error: 'Something went wrong. Please try again.',
    notSignedIn: 'Please sign in to continue.',
  },
  et: {
    brand: 'PRAYER',
    language: 'Keel',
    account: 'Konto',
    signOut: 'Logi välja',
    about: 'Meist',
    contact: 'Kontakt',
    privacy: 'Privaatsus',
    platformCredit: 'Prayer 365 — palveplatvorm.',
    loading: 'Laadimine…',
    empty: 'Siin pole veel midagi.',
    error: 'Midagi läks valesti. Palun proovi uuesti.',
    notSignedIn: 'Jätkamiseks palun logi sisse.',
  },
  sv: {
    brand: 'PRAYER',
    language: 'Språk',
    account: 'Konto',
    signOut: 'Logga ut',
    about: 'Om',
    contact: 'Kontakt',
    privacy: 'Integritet',
    platformCredit: 'Prayer 365 — en böneplattform.',
    loading: 'Laddar…',
    empty: 'Inget här ännu.',
    error: 'Något gick fel. Försök igen.',
    notSignedIn: 'Logga in för att fortsätta.',
  },
  fi: {
    brand: 'PRAYER',
    language: 'Kieli',
    account: 'Tili',
    signOut: 'Kirjaudu ulos',
    about: 'Tietoja',
    contact: 'Yhteystiedot',
    privacy: 'Tietosuoja',
    platformCredit: 'Prayer 365 — rukousalusta.',
    loading: 'Ladataan…',
    empty: 'Täällä ei ole vielä mitään.',
    error: 'Jokin meni pieleen. Yritä uudelleen.',
    notSignedIn: 'Kirjaudu sisään jatkaaksesi.',
  },
} satisfies Record<SiteLocale, Record<string, string>>

export type SiteMessageKey = keyof (typeof SITE_MESSAGES)['en']
