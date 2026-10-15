import { db } from '../src/utils/db-connection'

import { seedAnnouncements } from './seeds/announcement'
import { seedChurches, seedSecondChurch, seedStJohnsChurch } from './seeds/church'
import { seedConsents } from './seeds/consent'
import { seedDonations } from './seeds/donation'
import { seedCountries } from './seeds/country'
import { seedEvents } from './seeds/event'
import { seedLanguages } from './seeds/language'
import { seedMediaAssets } from './seeds/media-asset'
import { seedGalleryItems } from './seeds/gallery'
import { seedNotificationRules } from './seeds/notification-rule'
import { seedOrgNodes } from './seeds/org-node'
import { seedPastors } from './seeds/pastor'
import { seedPermission } from './seeds/permission'
import { seedPrayers } from './seeds/prayer'
import { seedRequests } from './seeds/request'
import { seedRolePermissions } from './seeds/role-permission'
import { seedRoles } from './seeds/role'
import { seedUsers, seedAdminUser } from './seeds/user'
import { seedVoiceProfiles } from './seeds/voice-profile'

async function main() {
  // Access: permission catalogue, roles, then the role<->permission wiring.
  await seedPermission()
  await seedRoles()
  await seedRolePermissions()

  // Reference data + org hierarchy (org nodes must exist before user assignments).
  await seedLanguages()
  await seedCountries()
  await seedOrgNodes()

  // Admin (all-access actor) before domain seeds reference it.
  await seedAdminUser()

  // Placeholder domain graph (dependency order).
  await seedChurches()
  await seedSecondChurch()
  await seedStJohnsChurch()
  await seedUsers() // prayer test users + end-users (needs org nodes + demo church)
  await seedPastors() // links the demo pastor to the prayer_pastor test user
  await seedConsents()
  await seedMediaAssets()
  await seedGalleryItems()
  await seedVoiceProfiles()
  await seedPrayers()
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
