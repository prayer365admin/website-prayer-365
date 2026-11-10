import { POLICY_MESSAGES_EN_COOKIE } from './cookie'
import { POLICY_MESSAGES_EN_PRIVACY } from './privacy'
import { POLICY_MESSAGES_EN_TERMS } from './terms'

/** Page chrome plus the three documents, in the order the page renders them. */
export const POLICY_MESSAGES_EN = {
  policiesTitle: 'Privacy & Policies',
  policiesEyebrow: 'Legal & Privacy',
  policiesUpdated: 'Last updated: 2 November 2026',
  policiesNavLabel: 'Documents on this page',
  policiesNavPrivacy: 'Privacy Policy',
  policiesNavTerms: 'Terms & Conditions',
  policiesNavCookies: 'Cookie Policy',
  policiesContact: 'Questions about these documents? Write to johannes@prayer365.eu.',
  ...POLICY_MESSAGES_EN_PRIVACY,
  ...POLICY_MESSAGES_EN_TERMS,
  ...POLICY_MESSAGES_EN_COOKIE,
} satisfies Record<string, string>
