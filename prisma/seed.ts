import { db } from '../src/utils/db-connection'

import { seedAnnouncements } from './seeds/announcement'
import {
  seedChurches,
  seedSecondChurch,
  seedStJohnsChurch,
  seedAdditionalChurches,
} from './seeds/church'
import { seedConsents } from './seeds/consent'
import { seedDonations } from './seeds/donation'
import { seedCountries } from './seeds/country'
import { seedEvents } from './seeds/event'
import { seedLanguages } from './seeds/language'
import { ensureDemoMedia } from './seeds/demo-media'
import { seedChurchContent, seedChurchPrayers, seedVoiceActivations } from './seeds/demo-content'
import { seedMediaAssets } from './seeds/media-asset'
import { seedNotificationRules } from './seeds/notification-rule'
import { seedOrgNodes } from './seeds/org-node'
import { seedPastors } from './seeds/pastor'
import { seedPermission } from './seeds/permission'
import { seedRequests } from './seeds/request'
import { seedRolePermissions } from './seeds/role-permission'
import { seedRoles } from './seeds/role'
import { seedUsers, seedAdminUser } from './seeds/user'
import { seedVoiceProfiles } from './seeds/voice-profile'

/*
 * Seed phases, in DEPENDENCY order. The order is load-bearing:
 *
 *  - a prayer's audio row needs a READY voice profile AND a GENERATED_AUDIO media
 *    asset, so every media/voice seed runs BEFORE any prayer exists. The previous
 *    order created St. John's four prayers first, while the voice profile was
 *    still null, and they ended up with no audio row at all.
 *  - the demo media objects must exist in the ACTIVE bucket before a seeded row
 *    references them (ensureDemoMedia), otherwise every media URL 404s.
 *  - seedChurchPrayers() fails the seed when a published prayer has no approved,
 *    selected audio, so this defect cannot come back silently.
 */
async function main() {
  // 1. Access: catalogue, roles, then the role<->permission wiring.
  await seedPermission()
  await seedRoles()
  await seedRolePermissions()

  // 2. Reference data + org hierarchy (org nodes must exist before assignments).
  await seedLanguages()
  await seedCountries()
  await seedOrgNodes()

  // 3. Admin (all-access actor) before domain seeds reference it.
  await seedAdminUser()

  // 4. Church rows: profile, languages, service times, staff, events, announcements.
  await seedChurches()
  await seedSecondChurch()
  await seedStJohnsChurch()
  await seedAdditionalChurches()

  // 5. Accounts: prayer test users + end users (needs org nodes + church rows).
  await seedUsers()

  // 6. Media + voice dependencies — all of them before the first prayer.
  await seedPastors() // links the demo pastor to the prayer_pastor test user
  await ensureDemoMedia() // uploads the demo objects into the ACTIVE bucket
  await seedMediaAssets() // voice sample + consent evidence rows
  await seedChurchContent() // covers, galleries, staff, events, announcements
  await seedConsents()
  await seedVoiceProfiles()

  // 7. Prayers, each with an approved audio asset (fails loudly if not).
  await seedChurchPrayers()
  await seedVoiceActivations()

  // 8. Demo activity at the demo church.
  await seedEvents()
  await seedAnnouncements()
  await seedRequests()
  await seedDonations()

  // Notifications
  await seedNotificationRules()
}

main()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console -- seed failure must surface on stdout
    console.log(e)
    await db.$disconnect()
    process.exit(1)
  })
