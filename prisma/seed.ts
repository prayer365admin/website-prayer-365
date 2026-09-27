import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

import { seedRoles } from './seeds/role'
import { seedUsers } from './seeds/user'
import { seedPermission } from './seeds/permission'

async function main() {
  await seedPermission()
  await seedRoles()
  await seedUsers()
}

main()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (e) => {
    console.log(e)
    await db.$disconnect()
    process.exit(1)
  })
