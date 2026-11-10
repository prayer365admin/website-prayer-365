import { POLICY_MESSAGES_FI_COOKIE } from './cookie'
import { POLICY_MESSAGES_FI_PRIVACY } from './privacy'
import { POLICY_MESSAGES_FI_TERMS } from './terms'

/** Sivun tekstit sekä kolme asiakirjaa siinä järjestyksessä kuin sivu ne näyttää. */
export const POLICY_MESSAGES_FI = {
  policiesTitle: 'Tietosuoja ja käytännöt',
  policiesEyebrow: 'Juridiikka ja tietosuoja',
  policiesUpdated: 'Viimeksi päivitetty: 2. marraskuuta 2026',
  policiesNavLabel: 'Tämän sivun asiakirjat',
  policiesNavPrivacy: 'Tietosuojaseloste',
  policiesNavTerms: 'Käyttöehdot',
  policiesNavCookies: 'Evästekäytäntö',
  policiesContact: 'Kysyttävää näistä asiakirjoista? Kirjoita osoitteeseen johannes@prayer365.eu.',
  ...POLICY_MESSAGES_FI_PRIVACY,
  ...POLICY_MESSAGES_FI_TERMS,
  ...POLICY_MESSAGES_FI_COOKIE,
} satisfies Record<string, string>
