import { POLICY_MESSAGES_SV_COOKIE } from './cookie'
import { POLICY_MESSAGES_SV_PRIVACY } from './privacy'
import { POLICY_MESSAGES_SV_TERMS } from './terms'

/** Sidans texter plus de tre dokumenten, i samma ordning som sidan renderar dem. */
export const POLICY_MESSAGES_SV = {
  policiesTitle: 'Integritet och policyer',
  policiesEyebrow: 'Juridik och integritet',
  policiesUpdated: 'Senast uppdaterad: 2 november 2026',
  policiesNavLabel: 'Dokument på denna sida',
  policiesNavPrivacy: 'Integritetspolicy',
  policiesNavTerms: 'Villkor',
  policiesNavCookies: 'Cookiepolicy',
  policiesContact: 'Frågor om dessa dokument? Skriv till johannes@prayer365.eu.',
  ...POLICY_MESSAGES_SV_PRIVACY,
  ...POLICY_MESSAGES_SV_TERMS,
  ...POLICY_MESSAGES_SV_COOKIE,
} satisfies Record<string, string>
