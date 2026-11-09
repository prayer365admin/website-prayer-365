import { POLICY_MESSAGES_ET_COOKIE } from './cookie'
import { POLICY_MESSAGES_ET_PRIVACY } from './privacy'
import { POLICY_MESSAGES_ET_TERMS } from './terms'

/** Lehe tekst ja kolm dokumentit, samas järjekorras nagu lehel. */
export const POLICY_MESSAGES_ET = {
  policiesTitle: 'Privaatsus ja poliitikad',
  policiesEyebrow: 'Õiguslik teave ja privaatsus',
  policiesUpdated: 'Viimati uuendatud: 2. november 2026',
  policiesNavLabel: 'Dokumendid sellel lehel',
  policiesNavPrivacy: 'Privaatsuspoliitika',
  policiesNavTerms: 'Kasutustingimused',
  policiesNavCookies: 'Küpsiste poliitika',
  policiesContact: 'Küsimused nende dokumentide kohta? Kirjuta aadressile johannes@prayer365.eu.',
  ...POLICY_MESSAGES_ET_PRIVACY,
  ...POLICY_MESSAGES_ET_TERMS,
  ...POLICY_MESSAGES_ET_COOKIE,
} satisfies Record<string, string>
