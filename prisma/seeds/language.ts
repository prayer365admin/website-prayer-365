import { db } from '../../src/utils/db-connection'

// BCP-47 codes; SPEC 5.1 requires seeding en, et, fi.
const languages = [
  { code: 'en', name: 'English', enabled: true },
  { code: 'et', name: 'Eesti', enabled: true },
  { code: 'fi', name: 'Suomi', enabled: true },
]

export const seedLanguages = async () => {
  await db.language.createMany({ data: languages, skipDuplicates: true })
}
