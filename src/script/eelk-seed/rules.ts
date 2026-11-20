import type { EelkRow } from './parse'

export interface AddressParts {
  line1: string
  city: string
  postalCode: string | null
  county: string | null
}

/** The source shouts only the place name ("AEGVIIDU Aleksandri kogudus"); proper nouns keep their case. */
const ALL_CAPS = /^[A-ZÕÄÖÜŠŽ0-9-]+$/

const capitalisePart = (part: string): string => {
  const lower = part.toLocaleLowerCase('et')
  return lower.charAt(0).toLocaleUpperCase('et') + lower.slice(1)
}

export const titleCaseName = (raw: string): string =>
  raw
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => (ALL_CAPS.test(word) ? word.split('-').map(capitalisePart).join('-') : word))
    .join(' ')

export const splitAddress = (line: string): AddressParts => {
  const parts = line
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const tail = parts.at(-1) ?? ''
  const postcode = tail.match(/^(\d{5})\s+(.+)$/)
  const body = postcode ? parts.slice(0, -1) : parts
  return {
    line1: body[0] ?? line.trim(),
    city: body[1] ?? body[0] ?? '',
    postalCode: postcode?.[1] ?? null,
    county: postcode?.[2] ?? null,
  }
}

export const phonesFrom = (phoneLine: string | null): string[] => {
  if (!phoneLine) return []
  const withoutEmail = phoneLine.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ')
  const matches = withoutEmail.match(/(?:\+372\s?)?\d(?:[\d\s-]{5,}\d)/g) ?? []
  return matches
    .map((match) => match.replace(/\s+/g, ' ').trim())
    .filter((match) => match.replace(/\D/g, '').length >= 7)
    .map((match) => match.replace(/^\+372\s?/, ''))
}

export const contactsFor = (row: EelkRow): { email?: string; phone?: string } => {
  const phones = phonesFrom(row.phoneLine)
  return {
    ...(row.email ? { email: row.email } : {}),
    ...(phones.length > 0 ? { phone: phones.join(', ') } : {}),
  }
}

/** Nodes that already exist in PROD under an English name (plan 042, E7). */
export const DEANERY_ALIASES: Record<string, string> = {
  'Lääne praostkond': 'Lääne Deanery',
  'Tallinna praostkond': 'Tallinn Deanery',
  'Ida-Harju praostkond': 'Ida-Harju Deanery',
  'Viljandi praostkond': 'Viljandi Deanery',
  'Pärnu praostkond': 'Pärnu Deanery',
}

export const deaneryNodeName = (deanery: string): string => DEANERY_ALIASES[deanery] ?? deanery

/**
 * reg code -> the slug of the PROD church this row updates (plan 042, E8). Built from the
 * PROD audit + the row names; a church missing here is never touched.
 */
export const EXISTING_SLUG_BY_REG_CODE: Record<string, string> = {
  '80210533': 'haapsalu-cathedral',
  '80211171': 'haljala-st-maurices-church',
  '80208246': 'halliste-st-annes-church',
  '80208677': 'jarva-peetri-st-peters-church',
  '80210970': 'kaarli-kirik-st-charless-church',
  '80210378': 'kaarma-st-peter-and-st-pauls-church',
  '80208983': 'kambja-st-martins-church',
  '80211076': 'karuse-st-margarets-church',
  '80209961': 'kihelkonna-st-michaels-church',
  '80208683': 'marjamaa-st-marys-church',
  '80211018': 'parnu-st-elizabeths-church',
  '80209174': 'rapla-st-mary-magdalene-church',
  '80209270': 'tallinn-cathedral-of-st-mary',
  '80211062': 'tallinn-st-johns-church',
  '80209858': 'tallinn-swedish-st-michaels-church',
  '80209487': 'tartu-st-johns-church',
  '80210906': 'tartu-st-marys-church',
  '80209375': 'tartu-st-pauls-church',
  '80209978': 'tartu-st-peters-church',
  '80209820': 'viimsi-st-james-church',
  '80209346': 'viljandi-st-johns-church',
  '80210846': 'viljandi-st-pauls-church',
  '80210295': 'vonnu-st-james-church',
}

/** PROD churches with no EELK row; never matched by email either (narva@eelk.ee is shared). */
export const NO_EELK_ROW_SLUGS = ['narva-alexanders-church'] as const
