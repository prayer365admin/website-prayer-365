import { SiteLocale } from '@/config/site-locale'
import { POLICY_MESSAGES_EN } from './en'
import { POLICY_MESSAGES_ET } from './et'
import { POLICY_MESSAGES_FI } from './fi'
import { POLICY_MESSAGES_SV } from './sv'

export { POLICY_MESSAGES_EN, POLICY_MESSAGES_ET, POLICY_MESSAGES_FI, POLICY_MESSAGES_SV }

/**
 * `/privacy` copy in every website locale.
 *
 * Split out of `messages.ts` because the three policies are ~200 long keys per
 * language: keeping them in per-locale modules lets the legal text be reviewed
 * as a document instead of as rows in a 3,000-line map. `messages.ts` spreads
 * these blocks into `SITE_MESSAGES`, so `SiteMessageKey` and `translate` see them
 * exactly like any other website string.
 */
export const POLICY_MESSAGES = {
  en: POLICY_MESSAGES_EN,
  et: POLICY_MESSAGES_ET,
  sv: POLICY_MESSAGES_SV,
  fi: POLICY_MESSAGES_FI,
} satisfies Record<SiteLocale, Record<string, string>>
