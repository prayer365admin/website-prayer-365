import { db } from '../../src/utils/db-connection'

// ⚠️ PLACEHOLDER country list — INVENTED for schema/testing, NOT confirmed launch
// countries. SPEC D-decision: launch countries and participating churches are
// owned by the project owner. Replace these before any real rollout.
const countries = [
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'SG', name: 'Singapore' },
]

export const seedCountries = async () => {
  await db.country.createMany({ data: countries, skipDuplicates: true })
}
