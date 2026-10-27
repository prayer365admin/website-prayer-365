import { db } from '../src/utils/db-connection'

import {
  seedViimsiAnnouncements,
  seedViimsiChurch,
  seedViimsiCustomers,
  seedViimsiDraftPrayers,
  seedViimsiPrayers,
  seedViimsiRoleAssignments,
} from './seeds/viimsi'

/**
 * Viimsi-only seed. Run the general seed first because this seed reuses its
 * administrator, languages, roles, test role accounts and base Estonia nodes.
 */
async function main() {
  await seedViimsiChurch()
  await seedViimsiRoleAssignments()
  await seedViimsiCustomers()
  await seedViimsiAnnouncements()
  await seedViimsiPrayers()
  await seedViimsiDraftPrayers()
}

main()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console -- seed failure must surface on stdout
    console.log(error)
    await db.$disconnect()
    process.exit(1)
  })
